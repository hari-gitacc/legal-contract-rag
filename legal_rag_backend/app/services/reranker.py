import logging
from typing import List, Tuple
from flashrank import Ranker, RerankRequest
from langchain_core.documents import Document
from app.config import settings

logger = logging.getLogger("FlashRankReranker")

class LocalReranker:
    def __init__(self):
        logger.info(f"Initializing local FlashRank ranker: {settings.reranker_model_name}")
        self.ranker = Ranker(model_name=settings.reranker_model_name, cache_dir="/tmp/flashrank")

    def rerank(self, query: str, documents: List[Document], top_k: int = 5) -> Tuple[List[Document], float]:
        if not documents:
            return [], 0.0

        passages = [
            {"id": idx, "text": doc.page_content, "meta": doc.metadata}
            for idx, doc in enumerate(documents)
        ]

        rerank_req = RerankRequest(query=query, passages=passages)
        results = self.ranker.rerank(rerank_req)

        top_results = results[:top_k]
        highest_score = top_results[0]["score"] if top_results else 0.0

        reranked_docs = []
        for item in top_results:
            reranked_docs.append(
                Document(
                    page_content=item["text"],
                    metadata={**item["meta"], "rerank_score": item["score"]}
                )
            )

        logger.info(f"Reranked {len(documents)} -> {len(reranked_docs)} chunks. Top score: {highest_score:.4f}")
        return reranked_docs, float(highest_score)

local_reranker = LocalReranker()
