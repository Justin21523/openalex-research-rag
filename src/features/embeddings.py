"""Sentence-transformer embedder for works and queries."""

import duckdb

from src.preprocessing.text_cleaner import build_searchable_text
from src.utils.logging import get_logger

logger = get_logger(__name__)


class WorkEmbedder:
    """Lazy-loading SentenceTransformer embedder."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self._model_name = model_name
        self._model = None

    def _get_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading embedding model: %s", self._model_name)
            self._model = SentenceTransformer(self._model_name)
        return self._model

    def encode(self, texts: list[str], batch_size: int = 64) -> list[list[float]]:
        """Encode a list of texts; returns list of float vectors."""
        model = self._get_model()
        vectors = model.encode(texts, batch_size=batch_size, show_progress_bar=False, normalize_embeddings=True)
        return vectors.tolist()

    def encode_query(self, query: str) -> list[float]:
        """Encode a single query string."""
        return self.encode([query])[0]

    def encode_works(
        self,
        conn: duckdb.DuckDBPyConnection,
        vector_store,
        batch_size: int = 64,
    ) -> int:
        """Fetch all works from DuckDB, embed, and upsert into vector_store."""
        rows = conn.execute(
            "SELECT work_id, title, abstract, publication_year, cited_by_count, primary_location_name FROM works"
        ).fetchall()

        if not rows:
            raise RuntimeError("No works in DuckDB. Run 'make etl' first.")

        work_ids = [r[0] for r in rows]
        texts = [build_searchable_text(r[1] or "", r[2] or "") for r in rows]
        metadatas = [
            {
                "year": r[3] or 0,
                "cited_by_count": r[4] or 0,
                "journal": r[5] or "",
            }
            for r in rows
        ]

        logger.info("Encoding %d works with model '%s' …", len(rows), self._model_name)
        embeddings = self.encode(texts, batch_size=batch_size)

        vector_store.upsert(
            work_ids=work_ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )
        logger.info("Indexed %d works into vector store.", len(rows))
        return len(rows)
