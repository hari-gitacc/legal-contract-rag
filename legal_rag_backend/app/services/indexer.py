import os
import json
import logging
from typing import List, Dict, Any, Optional
from pinecone import Pinecone, ServerlessSpec
from pinecone_text.sparse import BM25Encoder
from sentence_transformers import SentenceTransformer
from langchain_core.documents import Document
from app.config import settings

logger = logging.getLogger("PineconeIndexer")

class PineconeHybridIndexer:
    def __init__(self):
        self.pc = Pinecone(api_key=settings.pinecone_api_key)
        self.index_name = settings.pinecone_index_name
        self._ensure_index_exists()
        self.index = self.pc.Index(self.index_name)
        
        logger.info(f"Loading local embedding model: {settings.embedding_model_name}")
        self.dense_model = SentenceTransformer(settings.embedding_model_name)
        
        self.bm25 = BM25Encoder()
        self._load_or_init_bm25()

    def _ensure_index_exists(self):
        indexes = [i.name for i in self.pc.list_indexes()]
        if self.index_name not in indexes:
            logger.info(f"Creating cloud index: {self.index_name} (dim={settings.embedding_dimension})")
            self.pc.create_index(
                name=self.index_name,
                dimension=settings.embedding_dimension,
                metric="dotproduct",
                spec=ServerlessSpec(cloud=settings.pinecone_cloud, region=settings.pinecone_region)
            )
            logger.info("Pinecone Cloud index initialized.")

    def _load_or_init_bm25(self):
        if os.path.exists(settings.bm25_path):
            try:
                self.bm25.load(settings.bm25_path)
                logger.info("Loaded persisted BM25 parameters.")
            except Exception:
                self.bm25 = BM25Encoder.default()
        else:
            self.bm25 = BM25Encoder.default()

    def save_bm25(self):
        self.bm25.dump(settings.bm25_path)

    def encode_dense(self, texts: List[str]) -> List[List[float]]:
        embeddings = self.dense_model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return embeddings.tolist()

    def index_document_chunks(self, chunks: List[Document]):
        if not chunks:
            return
        corpus = [c.page_content for c in chunks]
        self.bm25.fit(corpus)
        self.save_bm25()

        dense_vectors = self.encode_dense(corpus)
        vectors_to_upsert = []

        for idx, (chunk, dense_vec) in enumerate(zip(chunks, dense_vectors)):
            sparse_dict = self.bm25.encode_documents(chunk.page_content)
            chunk_id = chunk.metadata.get("chunk_id", f"chunk_{idx}")

            metadata = {
                **chunk.metadata,
                "text": chunk.page_content
            }

            vectors_to_upsert.append({
                "id": chunk_id,
                "values": dense_vec,
                "sparse_values": {
                    "indices": sparse_dict["indices"],
                    "values": sparse_dict["values"]
                },
                "metadata": metadata
            })

        # Batch upsert in sizes of 100
        batch_size = 100
        for i in range(0, len(vectors_to_upsert), batch_size):
            batch = vectors_to_upsert[i : i + batch_size]
            self.index.upsert(vectors=batch)
        logger.info(f"Successfully upserted {len(vectors_to_upsert)} chunks to Pinecone Cloud.")

    def delete_document(self, document_name: str):
        try:
            self.index.delete(filter={"document_name": {"$eq": document_name}})
            logger.info(f"Deleted vectors for {document_name} from Pinecone Cloud.")
        except Exception as e:
            logger.error(f"Error deleting document from Pinecone: {e}")

    def hybrid_search(
        self,
        query: str,
        top_k: int = 20,
        alpha: float = 0.5,
        filter_dict: Optional[Dict[str, Any]] = None
    ) -> List[Document]:
        # 1. Local dense encoding & scaling
        dense_vec = self.encode_dense([query])[0]
        scaled_dense = [v * alpha for v in dense_vec]

        # 2. Local sparse encoding & scaling
        sparse_dict = self.bm25.encode_queries(query)
        scaled_sparse = {
            "indices": sparse_dict["indices"],
            "values": [v * (1.0 - alpha) for v in sparse_dict["values"]]
        }

        # 3. Pinecone Cloud Query
        kwargs: Dict[str, Any] = {
            "vector": scaled_dense,
            "sparse_vector": scaled_sparse,
            "top_k": top_k,
            "include_metadata": True
        }
        if filter_dict:
            kwargs["filter"] = filter_dict

        res = self.index.query(**kwargs)
        documents = []
        for match in res.get("matches", []):
            meta = match.get("metadata", {})
            text = meta.pop("text", "")
            documents.append(
                Document(
                    page_content=text,
                    metadata={**meta, "score": match.get("score", 0.0)}
                )
            )
        if documents:
            print(f"👉 [Indexer] hybrid_search returned {len(documents)} matches. Top doc preview: {documents[0].page_content[:100]!r}...")
        else:
            print(f"👉 [Indexer] hybrid_search returned 0 matches.")
        return documents

indexer = PineconeHybridIndexer()
