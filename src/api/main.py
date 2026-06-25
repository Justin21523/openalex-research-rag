"""FastAPI application entry point."""

# ── HuggingFace lock-dir guard ────────────────────────────────────────────────
# Some environments point HF_HOME at a shared cache (e.g. a Windows /mnt/c mount)
# whose `.locks` files are owned by another user and not writable. That makes
# SentenceTransformer model loads fail with PermissionError, which breaks vector
# search and the RAG pipeline. If the configured HF cache can't be locked, fall
# back to a native, writable HF_HOME while keeping the existing model cache
# discoverable via a symlinked `hub` dir. This runs before any HF import.
import os as _os


def _ensure_writable_hf_home() -> None:
    native = _os.path.expanduser("~/.cache/openalex-hf")
    if _os.environ.get("HF_HOME") == native:
        return  # already redirected

    hf_home = _os.environ.get("HF_HOME") or _os.path.expanduser("~/.cache/huggingface")
    existing_hub = _os.path.join(hf_home, "hub")

    # Probing the .locks dir for writability is not enough: the shared cache can
    # contain per-model .lock files owned by another user that we can open for
    # read but not write. The only reliable fix is to relocate HF_HOME to a
    # native, writable dir while keeping the existing model cache discoverable
    # through a symlinked `hub`. Fresh lock files there are owned by us.
    if not _os.path.isdir(existing_hub):
        return  # nothing to mirror; leave HF defaults untouched

    try:
        _os.makedirs(native, exist_ok=True)
        link = _os.path.join(native, "hub")
        if not _os.path.exists(link):
            _os.symlink(existing_hub, link)
        _os.environ["HF_HOME"] = native
        _os.environ["HF_HUB_CACHE"] = link
        _os.environ.pop("TRANSFORMERS_CACHE", None)
    except OSError:
        pass


_ensure_writable_hf_home()

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import asyncio

from src.api.routers import (
    analytics, annotations, authors, conversations, export_api, graph, health,
    import_api, ingest, institutions, pipeline, playground, rag,
    reading_list, search, topics, works,
)
from src.api.state import init_state
from src.utils.config import get_settings
from src.utils.db import get_connection
from src.utils.logging import get_logger, setup_logging

logger = get_logger(__name__)
settings = get_settings()


async def _background_warmup():
    """Pre-warm expensive aggregation endpoints after startup."""
    await asyncio.sleep(5)  # Wait for DB and state to fully initialise
    try:
        from src.api.routers.topics import top_concepts, journal_stats
        from src.utils.db import get_connection as _gc
        conn = _gc()
        logger.info("Warming up concepts cache…")
        top_concepts(limit=50, conn=conn)
        logger.info("Warming up journals cache…")
        journal_stats(limit=30, sort_by="paper_count", conn=conn)
        journal_stats(limit=30, sort_by="avg_citations", conn=conn)
        logger.info("Startup warmup complete.")
    except Exception as exc:
        logger.warning("Startup warmup failed (non-fatal): %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.log_level)
    logger.info("Starting OpenAlex Research Intelligence API …")
    get_connection()
    init_state()
    logger.info("Server ready.")
    asyncio.create_task(_background_warmup())
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="OpenAlex Research Intelligence",
    description=(
        "Scholarly paper search, citation graph, topic trend analysis, "
        "and citation-grounded RAG powered by OpenAlex data."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analytics.router)
app.include_router(search.router)
app.include_router(works.router)
app.include_router(authors.router)
app.include_router(institutions.router)
app.include_router(topics.router)
app.include_router(graph.router)
app.include_router(rag.router)
app.include_router(pipeline.router)
app.include_router(playground.router)
app.include_router(annotations.router)
app.include_router(conversations.router)
app.include_router(export_api.router)
app.include_router(ingest.router)
app.include_router(reading_list.router)
app.include_router(import_api.router)
