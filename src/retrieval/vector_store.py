"""ChromaDB vector store wrapper."""

from pathlib import Path

import chromadb

from src.utils.logging import get_logger
from src.utils.paths import CHROMA_DIR

logger = get_logger(__name__)

_COLLECTION_NAME = "openalex_works"
_CHUNK_SIZE = 500


class VectorStore:
    """Thin wrapper around a ChromaDB PersistentClient collection."""

    def __init__(self, persist_directory: str | Path | None = None) -> None:
        self._dir = str(persist_directory or CHROMA_DIR)
        self._client: chromadb.PersistentClient | None = None
        self._collection: chromadb.Collection | None = None

    def _get_client(self) -> chromadb.PersistentClient:
        if self._client is None:
            self._client = chromadb.PersistentClient(path=self._dir)
        return self._client

    def _get_collection(self) -> chromadb.Collection:
        if self._collection is None:
            self._collection = self._get_client().get_or_create_collection(
                name=_COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    def upsert(
        self,
        work_ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict] | None = None,
    ) -> None:
        """Batch upsert embeddings into ChromaDB in chunks."""
        col = self._get_collection()
        for i in range(0, len(work_ids), _CHUNK_SIZE):
            chunk_ids = work_ids[i : i + _CHUNK_SIZE]
            chunk_embs = embeddings[i : i + _CHUNK_SIZE]
            chunk_docs = documents[i : i + _CHUNK_SIZE]
            chunk_meta = metadatas[i : i + _CHUNK_SIZE] if metadatas else None
            col.upsert(
                ids=chunk_ids,
                embeddings=chunk_embs,
                documents=chunk_docs,
                metadatas=chunk_meta,
            )
            logger.debug("Upserted %d/%d vectors", min(i + _CHUNK_SIZE, len(work_ids)), len(work_ids))

    def search(
        self,
        query_embedding: list[float],
        k: int = 10,
        where: dict | None = None,
    ) -> list[dict]:
        """Query ChromaDB and return results with similarity scores (not distances)."""
        col = self._get_collection()
        kwargs: dict = {"query_embeddings": [query_embedding], "n_results": min(k, self.count())}
        if where:
            kwargs["where"] = where
        try:
            result = col.query(**kwargs)
        except Exception as exc:
            logger.warning("Vector search error: %s", exc)
            return []

        ids = result.get("ids", [[]])[0]
        distances = result.get("distances", [[]])[0]
        out = []
        for rank, (wid, dist) in enumerate(zip(ids, distances), 1):
            out.append({
                "work_id": wid,
                "vector_score": float(1.0 - dist),  # cosine distance → similarity
                "rank": rank,
            })
        return out

    def count(self) -> int:
        try:
            return self._get_collection().count()
        except Exception:
            return 0

    def get_embedding(self, work_id: str) -> list[float] | None:
        """Return the stored embedding vector for a work_id, or None if not found."""
        col = self._get_collection()
        try:
            result = col.get(ids=[work_id], include=["embeddings"])
            embs = result.get("embeddings") or []
            if embs and embs[0] is not None:
                return list(embs[0])
        except Exception as exc:
            logger.warning("get_embedding error for %s: %s", work_id, exc)
        return None

    def get_all_embeddings(self, limit: int = 5000) -> tuple[list[str], list[list[float]]]:
        """Return (work_ids, embeddings) for up to `limit` works."""
        col = self._get_collection()
        try:
            result = col.get(include=["embeddings"], limit=limit)
            ids = result.get("ids") or []
            embs = result.get("embeddings") or []
            return ids, [list(e) for e in embs]
        except Exception as exc:
            logger.warning("get_all_embeddings error: %s", exc)
            return [], []

    def is_ready(self) -> bool:
        return self.count() > 0

    def reset(self) -> None:
        """Delete and recreate the collection (for re-indexing)."""
        client = self._get_client()
        try:
            client.delete_collection(_COLLECTION_NAME)
        except Exception:
            pass
        self._collection = None
        logger.info("Vector store reset.")
