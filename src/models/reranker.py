"""Optional cross-encoder reranker."""

from src.utils.logging import get_logger

logger = get_logger(__name__)

_DEFAULT_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


class CrossEncoderReranker:
    """Cross-encoder reranker (requires sentence-transformers)."""

    def __init__(self, model_name: str = _DEFAULT_MODEL) -> None:
        self._model_name = model_name
        self._model = None

    def _get_model(self):
        if self._model is None:
            from sentence_transformers import CrossEncoder
            logger.info("Loading cross-encoder: %s", self._model_name)
            self._model = CrossEncoder(self._model_name)
        return self._model

    def rerank(self, query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
        """Score (query, title+abstract) pairs and return top_k by score."""
        model = self._get_model()
        pairs = [(query, f"{c.get('title', '')} {c.get('abstract', '')}") for c in candidates]
        scores = model.predict(pairs)
        for cand, score in zip(candidates, scores):
            cand["rerank_score"] = float(score)
        return sorted(candidates, key=lambda x: -x.get("rerank_score", 0))[:top_k]
