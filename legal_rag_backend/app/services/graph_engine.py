import re
import json
import logging
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, START, END
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

from app.config import settings
from app.state import RAGGraphState
from app.services.indexer import indexer
from app.services.reranker import local_reranker

logger = logging.getLogger("LangGraphEngine")

# Initialize LLM (Gemini or OpenAI)
if settings.llm_provider == "openai" and settings.openai_api_key:
    from langchain_openai import ChatOpenAI
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0, openai_api_key=settings.openai_api_key)
else:
    from langchain_google_genai import ChatGoogleGenerativeAI
    llm = ChatGoogleGenerativeAI(
        model=settings.llm_model,
        temperature=0.0,
        google_api_key=settings.gemini_api_key
    )

# --- Node 1: Query Expander ---
class QueryExpansionOutput(BaseModel):
    queries: List[str] = Field(description="2 to 3 alternative search queries.")

def query_expander_node(state: RAGGraphState) -> Dict[str, Any]:
    question = state["question"]
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Generate 2-3 distinct search query reformulations using legal/contract synonyms. Output clean JSON."),
        ("human", "Original Query: {q}")
    ])
    try:
        structured_llm = llm.with_structured_output(QueryExpansionOutput)
        res = structured_llm.invoke(prompt.format_messages(q=question))
        queries = list(set([question] + res.queries))
    except Exception:
        queries = [question]
    print(f"👉 [GraphEngine | Query Expander Node] Expanded original question into {len(queries)} queries.")
    return {"expanded_queries": queries}

# --- Node 2: Hybrid Retriever (with Doc Filtering) ---
def hybrid_retriever_node(state: RAGGraphState) -> Dict[str, Any]:
    queries = state.get("expanded_queries", [state["question"]])
    selected_docs = state.get("selected_documents", None)
    
    # Construct Pinecone metadata filter if user selected specific files
    filter_dict = None
    if selected_docs and len(selected_docs) > 0:
        filter_dict = {"document_name": {"$in": selected_docs}}

    unique_chunks: Dict[str, Document] = {}
    for q in queries:
        docs = indexer.hybrid_search(
            query=q,
            top_k=settings.retrieval_top_k,
            alpha=settings.hybrid_alpha,
            filter_dict=filter_dict
        )
        for d in docs:
            cid = d.metadata.get("chunk_id", d.page_content[:50])
            if cid not in unique_chunks:
                unique_chunks[cid] = d

    retrieved_list = list(unique_chunks.values())
    if retrieved_list:
        print(f"👉 [GraphEngine | Retriever Node] Aggregated {len(retrieved_list)} unique chunks for {len(queries)} queries. Top doc preview: {retrieved_list[0].page_content[:100]!r}...")
    else:
        print(f"👉 [GraphEngine | Retriever Node] Aggregated 0 unique chunks for {len(queries)} queries.")
    return {"retrieved_chunks": retrieved_list}

# --- Node 3: Local Reranker ---
def reranker_node(state: RAGGraphState) -> Dict[str, Any]:
    chunks = state["retrieved_chunks"]
    reranked, top_score = local_reranker.rerank(
        query=state["question"],
        documents=chunks,
        top_k=settings.rerank_top_k
    )
    is_out_of_scope = top_score < settings.rerank_score_threshold or len(reranked) == 0
    if reranked:
        print(f"👉 [GraphEngine | Reranker Node] Reranked {len(chunks)} down to {len(reranked)} chunks. Top score: {top_score:.4f}. Top doc preview: {reranked[0].page_content[:100]!r}...")
    else:
        print(f"👉 [GraphEngine | Reranker Node] Reranked {len(chunks)} chunks, none passed criteria (Top score: {top_score}).")
    return {
        "reranked_chunks": reranked,
        "out_of_scope_flag": is_out_of_scope
    }

# --- Node 4: Out-Of-Scope Handler ---
def out_of_scope_node(state: RAGGraphState) -> Dict[str, Any]:
    target_docs = f"in {state['selected_documents']}" if state.get("selected_documents") else "in the uploaded contracts"
    print(f"👉 [GraphEngine | Out of Scope Node] Question is out of scope. Target docs: {target_docs}")
    return {
        "final_answer": f"I could not find sufficient authoritative information {target_docs} to answer your question.",
        "citations": [],
        "validation_passed": True
    }

# --- Node 5: Conflict Inspector ---
class ConflictCheck(BaseModel):
    has_conflict: bool = Field(description="True if documents contain opposing or contradictory statements.")
    details: str = Field(description="Explanation of the conflict, or empty if complementary.")

def conflict_inspector_node(state: RAGGraphState) -> Dict[str, Any]:
    chunks = state["reranked_chunks"]
    sources = list(set(c.metadata.get("document_name", "Unknown") for c in chunks))

    if len(sources) <= 1:
        return {"sources": sources, "conflict_flag": False, "conflict_details": None}

    ctx = "\n\n".join([f"[{c.metadata.get('citation_id')}]: {c.page_content}" for c in chunks])
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Analyze the chunks. Return has_conflict=True ONLY if terms or obligations directly contradict each other (e.g., conflicting liability limits, delivery deadlines, or payment terms). Complementary facts across files are NOT conflicts."),
        ("human", "Query: {q}\n\nContext:\n{ctx}")
    ])
    try:
        structured_llm = llm.with_structured_output(ConflictCheck)
        res = structured_llm.invoke(prompt.format_messages(q=state["question"], ctx=ctx))
        print(f"👉 [GraphEngine | Conflict Inspector Node] Analyzed {len(sources)} sources. Conflict detected: {res.has_conflict}")
        return {"sources": sources, "conflict_flag": res.has_conflict, "conflict_details": res.details if res.has_conflict else None}
    except Exception:
        print(f"👉 [GraphEngine | Conflict Inspector Node] Analysis failed, defaulting to no conflict.")
        return {"sources": sources, "conflict_flag": False, "conflict_details": None}

# --- Node 6: Answer Generator ---
def answer_generator_node(state: RAGGraphState) -> Dict[str, Any]:
    chunks = state["reranked_chunks"]
    conflict_flag = state.get("conflict_flag", False)
    conflict_details = state.get("conflict_details", "")
    feedback = state.get("validation_feedback", "")

    context_xml = "\n\n".join([
        f'<chunk id="{c.metadata.get("citation_id")}">\n{c.page_content}\n</chunk>'
        for c in chunks
    ])

    sys_prompt = (
        "You are an expert Legal Assistant. Answer the question using ONLY the provided XML chunks.\n"
        "STRICT CITATION RULES:\n"
        "1. Every factual statement must end with an exact bracketed citation matching the chunk id attribute, e.g. [Filename.pdf | Section X | Page Y].\n"
        "2. Do not invent citation IDs."
    )
    if conflict_flag:
        sys_prompt += f"\nDISCREPANCY ALERT: Multiple sources conflict on this matter: {conflict_details}. Explicitly compare and contrast the terms from both sources and cite each."
    if feedback:
        sys_prompt += f"\nCORRECTION NOTICE: Your previous answer failed citation validation: {feedback}. Fix all citations strictly."

    prompt = ChatPromptTemplate.from_messages([
        ("system", sys_prompt),
        ("human", "Context:\n<context>\n{ctx}\n</context>\n\nQuestion: {q}")
    ])

    res = llm.invoke(prompt.format_messages(ctx=context_xml, q=state["question"]))
    answer = res.content
    if isinstance(answer, list):
        answer = "".join([part.get("text", "") for part in answer if isinstance(part, dict) and "text" in part])
    elif not isinstance(answer, str):
        answer = str(answer)
    print(f"👉 [GraphEngine | Answer Generator Node] Generated final answer (preview): {answer[:150]!r}...")
    found_cits = re.findall(r"\[([^\]]+ \| [^\]]+ \| Page \d+)\]", answer)

    return {
        "final_answer": answer,
        "citations": list(set(found_cits))
    }

# --- Node 7: Citation Validator ---
class CitationValidation(BaseModel):
    is_valid: bool = Field(description="True if all claims are backed by their cited chunk and formatting is exact.")
    feedback: str = Field(description="Specific feedback if invalid.")

def citation_validator_node(state: RAGGraphState) -> Dict[str, Any]:
    chunks = state["reranked_chunks"]
    final_answer = state["final_answer"]
    regens = state.get("regeneration_count", 0)

    valid_cids = {c.metadata.get("citation_id") for c in chunks if "citation_id" in c.metadata}
    used_cids = re.findall(r"\[([^\]]+ \| [^\]]+ \| Page \d+)\]", final_answer)
    hallucinated = [c for c in used_cids if c not in valid_cids]

    if hallucinated:
        print(f"👉 [GraphEngine | Citation Validator Node] Validation FAILED! Hallucinated IDs: {hallucinated}. Triggering regeneration (Attempt {regens + 1}).")
        return {
            "validation_passed": False,
            "validation_feedback": f"Hallucinated citation IDs used: {hallucinated}. Allowed IDs: {list(valid_cids)}",
            "regeneration_count": regens + 1
        }

    print("👉 [GraphEngine | Citation Validator Node] Validation PASSED! All citations are exact and accurate.")
    return {"validation_passed": True, "validation_feedback": None}

# --- Router Functions ---
def route_after_rerank(state: RAGGraphState) -> str:
    if state.get("out_of_scope_flag", False):
        return "out_of_scope_node"
    return "conflict_inspector_node"

def route_after_validation(state: RAGGraphState) -> str:
    if state.get("validation_passed", False) or state.get("regeneration_count", 0) >= settings.max_regen_attempts:
        return END
    return "answer_generator_node"

# --- Assemble StateGraph ---
def build_graph():
    wf = StateGraph(RAGGraphState)
    wf.add_node("query_expander_node", query_expander_node)
    wf.add_node("hybrid_retriever_node", hybrid_retriever_node)
    wf.add_node("reranker_node", reranker_node)
    wf.add_node("out_of_scope_node", out_of_scope_node)
    wf.add_node("conflict_inspector_node", conflict_inspector_node)
    wf.add_node("answer_generator_node", answer_generator_node)
    wf.add_node("citation_validator_node", citation_validator_node)

    wf.add_edge(START, "query_expander_node")
    wf.add_edge("query_expander_node", "hybrid_retriever_node")
    wf.add_edge("hybrid_retriever_node", "reranker_node")

    wf.add_conditional_edges(
        "reranker_node",
        route_after_rerank,
        {
            "out_of_scope_node": "out_of_scope_node",
            "conflict_inspector_node": "conflict_inspector_node"
        }
    )
    wf.add_edge("out_of_scope_node", END)
    wf.add_edge("conflict_inspector_node", "answer_generator_node")
    wf.add_edge("answer_generator_node", "citation_validator_node")

    wf.add_conditional_edges(
        "citation_validator_node",
        route_after_validation,
        {
            END: END,
            "answer_generator_node": "answer_generator_node"
        }
    )
    return wf.compile()

rag_graph = build_graph()
