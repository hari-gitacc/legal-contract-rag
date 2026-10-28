from typing import List, Optional, Dict, Any
from typing_extensions import TypedDict
from langchain_core.documents import Document

class RAGGraphState(TypedDict):
    question: str
    selected_documents: Optional[List[str]]  # File filter passed from UI/User
    expanded_queries: List[str]
    retrieved_chunks: List[Document]
    reranked_chunks: List[Document]
    sources: List[str]
    out_of_scope_flag: bool
    conflict_flag: bool
    conflict_details: Optional[str]
    final_answer: str
    citations: List[str]
    validation_passed: bool
    validation_feedback: Optional[str]
    regeneration_count: int
