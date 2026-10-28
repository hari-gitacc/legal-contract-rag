import os
import shutil
from typing import List, Annotated 
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.config import settings
from app.api.schemas import ChatRequest, ChatResponse, DocumentInfo
from app.services.parser import DocumentParser
from app.services.indexer import indexer
from app.services.graph_engine import rag_graph

router = APIRouter()

@router.post("/documents/upload", response_model=List[DocumentInfo])
async def upload_documents(files: List[UploadFile] = File(...)):
    """Uploads legal contracts, parses, chunks, and indexes them into Pinecone Cloud."""
    uploaded_info = []
    for file in files:
        file_path = os.path.join(settings.storage_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. Parse and chunk locally
        raw_docs = DocumentParser.load_file(file_path, file.filename)
        chunks = DocumentParser.chunk_documents(raw_docs)

        # 2. Local Dense + Sparse Encoding and Pinecone Cloud Upsert
        indexer.index_document_chunks(chunks)

        size_kb = round(os.path.getsize(file_path) / 1024, 2)
        uploaded_info.append(DocumentInfo(filename=file.filename, file_size_kb=size_kb))

    return uploaded_info

@router.get("/documents", response_model=List[DocumentInfo])
async def list_documents():
    """Lists all contracts currently stored in the server storage."""
    docs = []
    for f in os.listdir(settings.storage_dir):
        fp = os.path.join(settings.storage_dir, f)
        if os.path.isfile(fp):
            docs.append(DocumentInfo(filename=f, file_size_kb=round(os.path.getsize(fp) / 1024, 2)))
    return docs

@router.delete("/documents/{filename}")
async def delete_document(filename: str):
    """Deletes contract from disk and removes its vectors from Pinecone Cloud."""
    file_path = os.path.join(settings.storage_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Document not found.")

    os.remove(file_path)
    indexer.delete_document(filename)
    return {"message": f"Successfully deleted {filename}"}

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Stateful LangGraph query engine supporting global or document-specific filtering."""
    initial_state = {
        "question": request.question,
        "selected_documents": request.selected_documents,
        "expanded_queries": [],
        "retrieved_chunks": [],
        "reranked_chunks": [],
        "sources": [],
        "out_of_scope_flag": False,
        "conflict_flag": False,
        "conflict_details": None,
        "final_answer": "",
        "citations": [],
        "validation_passed": False,
        "validation_feedback": None,
        "regeneration_count": 0,
    }

    result = rag_graph.invoke(initial_state)

    return ChatResponse(
        answer=result["final_answer"],
        citations=result.get("citations", []),
        sources=result.get("sources", []),
        conflict_detected=result.get("conflict_flag", False),
        conflict_details=result.get("conflict_details", None),
        out_of_scope=result.get("out_of_scope_flag", False),
    )
