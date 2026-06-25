"""POST /admin/ingest — trigger bulk OpenAlex ingestion with SSE progress stream."""

from __future__ import annotations

import asyncio
import json
import threading
from typing import AsyncGenerator

import duckdb
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from src.api.dependencies import get_app_state
from src.api.state import AppState
from src.ingestion.bulk_fetcher import DEFAULT_TOPICS, fetch_bulk
from src.utils.logging import get_logger
from src.utils.paths import DUCKDB_PATH

logger = get_logger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

# Simple in-process status tracking
_ingest_status: dict = {"running": False, "total_fetched": 0, "current_topic": ""}


@router.post("/ingest/openalex")
async def ingest_openalex(
    email: str = Query("", description="OpenAlex polite-pool email"),
    api_key: str = Query("", description="Optional OpenAlex API key"),
    topics: str = Query("", description="Comma-separated topic list (default: 8 built-in topics)"),
    limit_per_topic: int = Query(6500, ge=100, le=25000),
    state: AppState = Depends(get_app_state),
) -> StreamingResponse:
    """Start bulk OpenAlex ingestion. Streams SSE progress events.

    Event format: data: {"type": "progress"|"done"|"error", ...}
    """
    topic_list = (
        [(t.strip(), limit_per_topic) for t in topics.split(",") if t.strip()]
        if topics
        else [(name, limit_per_topic) for name, _ in DEFAULT_TOPICS]
    )

    # Use a thread-safe queue to pass progress events to the async generator
    queue: asyncio.Queue[dict | None] = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def _progress(topic: str, topic_fetched: int, total: int) -> None:
        event = {"type": "progress", "topic": topic, "topic_fetched": topic_fetched, "total_fetched": total}
        _ingest_status.update(running=True, total_fetched=total, current_topic=topic)
        asyncio.run_coroutine_threadsafe(queue.put(event), loop)

    def _run() -> None:
        # Open a dedicated connection for this thread — avoids sharing the singleton
        thread_conn = duckdb.connect(str(DUCKDB_PATH))
        try:
            _ingest_status.update(running=True, current_topic="starting…")  # set immediately
            total = fetch_bulk(
                conn=thread_conn,
                email=email,
                api_key=api_key,
                topics=topic_list,
                on_progress=_progress,
            )
            # Rebuild BM25 index after bulk ingest
            if state.bm25_index is not None:
                try:
                    logger.info("Rebuilding BM25 index after ingestion…")
                    state.bm25_index.build(thread_conn)
                except Exception as e:
                    logger.warning("BM25 rebuild failed: %s", e)
            _ingest_status.update(running=False, total_fetched=total)
            asyncio.run_coroutine_threadsafe(
                queue.put({"type": "done", "total_fetched": total}), loop
            )
        except Exception as exc:
            _ingest_status["running"] = False
            asyncio.run_coroutine_threadsafe(
                queue.put({"type": "error", "message": str(exc)}), loop
            )
        finally:
            thread_conn.close()
            asyncio.run_coroutine_threadsafe(queue.put(None), loop)  # sentinel

    if _ingest_status["running"]:
        async def _busy() -> AsyncGenerator[str, None]:
            yield f"data: {json.dumps({'type':'error','message':'Ingestion already running'})}\n\n"
        return StreamingResponse(_busy(), media_type="text/event-stream")

    threading.Thread(target=_run, daemon=True).start()  # daemon=True: won't block server shutdown

    async def _gen() -> AsyncGenerator[str, None]:
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/ingest/status")
def ingest_status() -> dict:
    """Return current ingestion status."""
    return _ingest_status
