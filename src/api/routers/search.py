"""GET /search — hybrid/BM25/vector paper search."""

import time
import uuid

from fastapi import APIRouter, Depends, Query

from src.api.dependencies import get_app_state, get_conn
from src.api.schemas.responses import SearchResponse, WorkHit
from src.api.state import AppState
from src.retrieval.duckdb_store import get_works_by_ids, search_fts
from src.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResponse)
def search_works(
    q: str = Query(..., min_length=1, description="Search query"),
    k: int = Query(10, ge=1, le=100),
    mode: str = Query("hybrid", pattern="^(bm25|vector|hybrid|fts)$"),
    year_from: int | None = Query(None),
    year_to: int | None = Query(None),
    rerank: bool = Query(False),
    conn=Depends(get_conn),
    state: AppState = Depends(get_app_state),
) -> SearchResponse:
    t0 = time.time()
    if mode == "fts":
        hits = search_fts(conn, q, k=k * 2)
    else:
        hits = state.hybrid_search.search(q, k=k * 2, mode=mode)

    # Hydrate with full metadata
    hit_ids = [h["work_id"] for h in hits]
    metadata = {w["work_id"]: w for w in get_works_by_ids(conn, hit_ids)}

    results: list[WorkHit] = []
    for hit in hits:
        meta = metadata.get(hit["work_id"], {})
        year = meta.get("publication_year")
        if year_from and year and year < year_from:
            continue
        if year_to and year and year > year_to:
            continue
        results.append(
            WorkHit(
                work_id=hit["work_id"],
                title=meta.get("title"),
                abstract=(meta.get("abstract") or "")[:300],
                publication_year=year,
                cited_by_count=meta.get("cited_by_count", 0),
                doi=meta.get("doi"),
                journal=meta.get("journal"),
                language=meta.get("language"),
                work_type=meta.get("type"),
                bm25_score=hit.get("bm25_score"),
                vector_score=hit.get("vector_score"),
                rrf_score=hit.get("rrf_score"),
                rank=len(results) + 1,
            )
        )
        if len(results) >= k:
            break

    # Optional reranking
    if rerank and state.reranker and results:
        candidates = [r.model_dump() for r in results]
        reranked = state.reranker.rerank(q, candidates, top_k=k)
        results = [WorkHit(**c) for c in reranked]

    latency_ms = (time.time() - t0) * 1000

    # Log query
    try:
        conn.execute(
            "INSERT OR REPLACE INTO query_logs VALUES (?,?,?,?,?,?,NOW())",
            [str(uuid.uuid4()), q, mode, k, len(results), latency_ms],
        )
        conn.commit()
    except Exception:
        pass

    return SearchResponse(
        query=q,
        mode=mode,
        k=k,
        total=len(results),
        latency_ms=round(latency_ms, 2),
        results=results,
    )
