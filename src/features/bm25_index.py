"""BM25 index builder and searcher backed by joblib persistence."""

from pathlib import Path

import duckdb
import joblib

from src.preprocessing.text_cleaner import build_searchable_text, clean_for_bm25
from src.utils.logging import get_logger
from src.utils.paths import BM25_INDEX_PATH

logger = get_logger(__name__)


class BM25Index:
    """BM25Okapi index over work titles + abstracts."""

    def __init__(self, index_path: Path | None = None) -> None:
        self._path = Path(index_path or BM25_INDEX_PATH)
        self._bm25 = None
        self._work_ids: list[str] = []

    def build(self, conn: duckdb.DuckDBPyConnection) -> "BM25Index":
        """Build the BM25 index from DuckDB works table."""
        from rank_bm25 import BM25Okapi

        rows = conn.execute("SELECT work_id, title, abstract FROM works").fetchall()
        if not rows:
            raise RuntimeError("No works found in DuckDB. Run 'make etl' first.")

        self._work_ids = [r[0] for r in rows]
        corpus = [
            clean_for_bm25(build_searchable_text(r[1] or "", r[2] or "")).split()
            for r in rows
        ]
        logger.info("Building BM25 index over %d documents …", len(corpus))
        self._bm25 = BM25Okapi(corpus)
        return self

    def save(self, path: Path | None = None) -> Path:
        """Persist index to disk with joblib."""
        p = Path(path or self._path)
        p.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"bm25": self._bm25, "work_ids": self._work_ids}, p)
        logger.info("BM25 index saved → %s", p)
        return p

    def load(self, path: Path | None = None) -> "BM25Index":
        """Load index from disk."""
        p = Path(path or self._path)
        if not p.exists():
            raise FileNotFoundError(f"BM25 index not found at {p}. Run 'make index' first.")
        data = joblib.load(p)
        self._bm25 = data["bm25"]
        self._work_ids = data["work_ids"]
        logger.info("BM25 index loaded (%d docs) from %s", len(self._work_ids), p)
        return self

    def search(self, query: str, k: int = 10) -> list[dict]:
        """Return top-k results as [{work_id, bm25_score, rank}]."""
        if self._bm25 is None:
            raise RuntimeError("BM25 index not built or loaded.")
        tokens = clean_for_bm25(query).split()
        scores = self._bm25.get_scores(tokens)
        # argsort descending
        ranked = sorted(enumerate(scores), key=lambda x: -x[1])[:k]
        return [
            {"work_id": self._work_ids[i], "bm25_score": float(score), "rank": rank + 1}
            for rank, (i, score) in enumerate(ranked)
        ]

    @property
    def is_ready(self) -> bool:
        return self._path.exists()

    @property
    def doc_count(self) -> int:
        return len(self._work_ids)
