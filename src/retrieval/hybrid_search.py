"""Hybrid BM25 + dense vector search with Reciprocal Rank Fusion."""

from src.features.bm25_index import BM25Index
from src.features.embeddings import WorkEmbedder
from src.retrieval.vector_store import VectorStore
from src.utils.logging import get_logger

logger = get_logger(__name__)


def reciprocal_rank_fusion(
    ranked_lists: list[list[tuple[str, int]]],
    rrf_k: int = 60,
) -> list[tuple[str, float]]:
    """Merge ranked lists with RRF: score = sum(1 / (rrf_k + rank))."""
    scores: dict[str, float] = {}
    for ranked in ranked_lists:
        for work_id, rank in ranked:
            scores[work_id] = scores.get(work_id, 0.0) + 1.0 / (rrf_k + rank)
    return sorted(scores.items(), key=lambda x: -x[1])


class HybridSearch:
    """Combines BM25 and dense vector search via RRF."""

    def __init__(
        self,
        bm25_index: BM25Index,
        vector_store: VectorStore,
        embedder: WorkEmbedder,
        rrf_k: int = 60,
    ) -> None:
        self._bm25 = bm25_index
        self._vs = vector_store
        self._embedder = embedder
        self._rrf_k = rrf_k

    def search(
        self,
        query: str,
        k: int = 10,
        fetch_k: int | None = None,
        mode: str = "hybrid",
    ) -> list[dict]:
        """Search with the specified mode; returns up to k results.

        mode: "bm25" | "vector" | "hybrid"
        """
        fetch_k = fetch_k or max(k * 4, 50)

        bm25_hits: list[dict] = []
        vector_hits: list[dict] = []

        if mode in ("bm25", "hybrid"):
            bm25_hits = self._bm25.search(query, k=fetch_k)

        if mode in ("vector", "hybrid"):
            query_emb = self._embedder.encode_query(query)
            vector_hits = self._vs.search(query_emb, k=fetch_k)

        if mode == "bm25":
            ranked = [(h["work_id"], h["rank"]) for h in bm25_hits]
            fused = [(wid, 0.0) for wid, _ in ranked[:k]]
            score_map = {h["work_id"]: h["bm25_score"] for h in bm25_hits}
        elif mode == "vector":
            ranked = [(h["work_id"], h["rank"]) for h in vector_hits]
            fused = [(wid, 0.0) for wid, _ in ranked[:k]]
            score_map = {h["work_id"]: h["vector_score"] for h in vector_hits}
        else:
            bm25_ranked = [(h["work_id"], h["rank"]) for h in bm25_hits]
            vec_ranked = [(h["work_id"], h["rank"]) for h in vector_hits]
            fused = reciprocal_rank_fusion([bm25_ranked, vec_ranked], self._rrf_k)[:k]
            score_map = {}

        bm25_score_map = {h["work_id"]: h["bm25_score"] for h in bm25_hits}
        vec_score_map = {h["work_id"]: h["vector_score"] for h in vector_hits}

        results = []
        for rank, (work_id, rrf_score) in enumerate(fused, 1):
            results.append({
                "work_id": work_id,
                "bm25_score": bm25_score_map.get(work_id),
                "vector_score": vec_score_map.get(work_id),
                "rrf_score": rrf_score if mode == "hybrid" else score_map.get(work_id, 0.0),
                "rank": rank,
            })
        return results
