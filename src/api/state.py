"""Application state singleton — loaded at FastAPI lifespan startup."""

from dataclasses import dataclass, field

from src.features.bm25_index import BM25Index
from src.features.embeddings import WorkEmbedder
from src.models.rag_pipeline import RAGPipeline
from src.models.reranker import CrossEncoderReranker
from src.retrieval.hybrid_search import HybridSearch
from src.retrieval.vector_store import VectorStore
from src.utils.config import get_settings
from src.utils.db import get_connection
from src.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class AppState:
    bm25_index: BM25Index | None = None
    vector_store: VectorStore | None = None
    embedder: WorkEmbedder | None = None
    hybrid_search: HybridSearch | None = None
    rag_pipeline: RAGPipeline | None = None
    reranker: CrossEncoderReranker | None = None
    conn: object = None  # duckdb.DuckDBPyConnection — for FTS and similar-works routes


_state: AppState | None = None


def get_state() -> AppState:
    if _state is None:
        raise RuntimeError("AppState not initialised. Call init_state() at startup.")
    return _state


def set_state(state: AppState) -> None:
    """Override state (used in tests)."""
    global _state
    _state = state


def init_state() -> AppState:
    """Build and cache AppState at server startup."""
    global _state
    settings = get_settings()
    conn = get_connection()

    bm25 = BM25Index()
    try:
        bm25.load()
    except FileNotFoundError:
        logger.warning("BM25 index not found — run 'make index' first.")

    vs = VectorStore(settings.chroma_dir)
    embedder = WorkEmbedder(settings.embeddings_model)
    search = HybridSearch(bm25, vs, embedder, rrf_k=settings.rrf_k)
    rag = RAGPipeline(
        search,
        conn,
        llama_base_url=settings.llama_base_url,
        llama_model=settings.llama_model,
        llama_max_tokens=settings.llama_max_tokens,
        llama_timeout=settings.llama_timeout,
        top_k=settings.rag_top_k,
    )

    _state = AppState(
        bm25_index=bm25,
        vector_store=vs,
        embedder=embedder,
        hybrid_search=search,
        rag_pipeline=rag,
        conn=conn,
    )
    logger.info(
        "AppState ready — BM25 docs: %d, ChromaDB: %d",
        bm25.doc_count,
        vs.count(),
    )
    return _state
