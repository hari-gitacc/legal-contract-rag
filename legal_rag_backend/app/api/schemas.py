from typing import List, Optional
from pydantic import BaseModel

class ChatRequest(BaseModel):
    question: str
    selected_documents: Optional[List[str]] = None  # None = query all documents

class ChatResponse(BaseModel):
    answer: str
    citations: List[str]
    sources: List[str]
    conflict_detected: bool
    conflict_details: Optional[str]
    out_of_scope: bool

class DocumentInfo(BaseModel):
    filename: str
    file_size_kb: float
