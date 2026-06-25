"""CLI script to build BM25 and ChromaDB indexes."""

import argparse

from src.features.bm25_index import BM25Index
from src.features.embeddings import WorkEmbedder
from src.retrieval.vector_store import VectorStore
from src.utils.config import get_settings
from src.utils.db import get_connection
from src.utils.logging import get_logger, setup_logging

logger = get_logger(__name__)


def build_fts_index(conn=None) -> None:
    """Build DuckDB FTS index on works(title, abstract). Safe to re-run (overwrite=1)."""
    setup_logging()
    if conn is None:
        conn = get_connection()
    conn.execute("INSTALL fts")
    conn.execute("LOAD fts")
    conn.execute(
        "PRAGMA create_fts_index('works', 'work_id', 'title', 'abstract', overwrite=1)"
    )
    logger.info("DuckDB FTS index built on works(title, abstract)")


def build_all(skip_embeddings: bool = False, skip_fts: bool = False) -> None:
    """Build BM25, ChromaDB vector indexes, and DuckDB FTS."""
    setup_logging()
    settings = get_settings()
    conn = get_connection()

    # ── BM25 ──────────────────────────────────────────────────────────────
    logger.info("Building BM25 index …")
    bm25 = BM25Index()
    bm25.build(conn).save()

    if skip_embeddings:
        logger.info("Skipping embeddings (--skip-embeddings flag set).")
    else:
        # ── Dense embeddings → ChromaDB ────────────────────────────────────────
        logger.info("Building vector embeddings …")
        vs = VectorStore(settings.chroma_dir)
        vs.reset()
        embedder = WorkEmbedder(settings.embeddings_model)
        n = embedder.encode_works(conn, vs, batch_size=settings.embeddings_batch_size)
        logger.info("Index build complete: %d BM25 docs, %d vectors", bm25.doc_count, n)

    if not skip_fts:
        # ── DuckDB FTS ────────────────────────────────────────────────────────
        logger.info("Building DuckDB FTS index …")
        build_fts_index(conn)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build search indexes")
    parser.add_argument("--skip-embeddings", action="store_true",
                        help="Only build BM25, skip ChromaDB embedding step")
    parser.add_argument("--skip-fts", action="store_true",
                        help="Skip DuckDB FTS index build")
    parser.add_argument("--fts-only", action="store_true",
                        help="Only (re)build DuckDB FTS index")
    args = parser.parse_args()
    if args.fts_only:
        build_fts_index()
    else:
        build_all(skip_embeddings=args.skip_embeddings, skip_fts=args.skip_fts)
