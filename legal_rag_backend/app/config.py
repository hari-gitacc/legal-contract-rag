import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # Pinecone Cloud
    pinecone_api_key: str = Field(..., alias="PINECONE_API_KEY")
    pinecone_index_name: str = Field(default="legal-contracts-free", alias="PINECONE_INDEX_NAME")
    pinecone_cloud: str = Field(default="aws", alias="PINECONE_CLOUD")
    pinecone_region: str = Field(default="us-east-1", alias="PINECONE_REGION")

    # LLM Settings
    llm_provider: str = Field(default="gemini", alias="LLM_PROVIDER")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    llm_model: str = Field(default="gemini-2.5-flash", alias="LLM_MODEL")

    # Local Free-Tier Embeddings (all-MiniLM-L6-v2 produces 384-dim vectors)
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    # Local Unlimited Reranker Model
    reranker_model_name: str = "ms-marco-MiniLM-L-12-v2"

    # Dynamic RAG Hyperparameters
    hybrid_alpha: float = Field(default=0.5, alias="HYBRID_ALPHA")
    retrieval_top_k: int = Field(default=20, alias="RETRIEVAL_TOP_K")
    rerank_top_k: int = Field(default=5, alias="RERANK_TOP_K")
    rerank_score_threshold: float = Field(default=0.30, alias="RERANK_SCORE_THRESHOLD")
    max_regen_attempts: int = Field(default=2, alias="MAX_REGEN_ATTEMPTS")

    # Storage paths
    storage_dir: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "contracts")
    bm25_path: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "bm25_params.json")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
os.makedirs(settings.storage_dir, exist_ok=True)
os.makedirs(os.path.dirname(settings.bm25_path), exist_ok=True)
