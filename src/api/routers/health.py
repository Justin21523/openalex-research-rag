"""GET /health endpoint."""

from fastapi import APIRouter, Depends

from src.api.dependencies import get_app_state, get_conn
from src.api.schemas.responses import HealthResponse
from src.api.state import AppState

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(
    conn=Depends(get_conn),
    state: AppState = Depends(get_app_state),
) -> HealthResponse:
    """Service health check with live resource counts."""
    try:
        works_count = conn.execute("SELECT COUNT(*) FROM works").fetchone()[0]
        db_status = "connected"
    except Exception:
        works_count = 0
        db_status = "error"

    llm_available = False
    if state.rag_pipeline:
        try:
            llm_available = state.rag_pipeline.is_llm_available()
        except Exception:
            pass

    return HealthResponse(
        status="ok",
        version="0.1.0",
        duckdb=db_status,
        works_count=works_count,
        chromadb_count=state.vector_store.count() if state.vector_store else 0,
        bm25_ready=state.bm25_index.is_ready if state.bm25_index else False,
        llm_available=llm_available,
    )
