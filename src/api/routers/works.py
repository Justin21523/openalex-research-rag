"""GET /works — work detail, citation graph, similar works, and compare."""

import time

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query

from src.api.dependencies import get_app_state, get_conn
from src.api.schemas.responses import CitationGraph, SimilarWorksResponse, WorkDetail, WorkHit, WorkRef
from src.api.state import AppState
from src.preprocessing.text_cleaner import build_searchable_text
from src.retrieval.duckdb_store import get_citation_neighbors, get_work_by_id, get_works_by_ids

router = APIRouter(prefix="/works", tags=["works"])


class CompareRequest(BaseModel):
    work_ids: list[str]


@router.get("/top", response_model=list[WorkHit])
def top_works(
    limit: int = Query(20, ge=1, le=100),
    conn=Depends(get_conn),
) -> list[WorkHit]:
    """Most-cited works — used for combobox presets and 'popular papers' cards."""
    rows = conn.execute(
        "SELECT work_id, title, publication_year, cited_by_count, primary_location_name "
        "FROM works ORDER BY cited_by_count DESC NULLS LAST LIMIT ?",
        [limit],
    ).fetchall()
    return [
        WorkHit(
            work_id=r[0],
            title=r[1],
            publication_year=r[2],
            cited_by_count=r[3] or 0,
            journal=r[4],
            rank=i + 1,
        )
        for i, r in enumerate(rows)
    ]


@router.get("/{work_id}", response_model=WorkDetail)
def get_work(work_id: str, conn=Depends(get_conn)) -> WorkDetail:
    work = get_work_by_id(conn, work_id)
    if not work:
        raise HTTPException(status_code=404, detail=f"Work '{work_id}' not found.")
    return WorkDetail(
        work_id=work["work_id"],
        title=work.get("title"),
        abstract=work.get("abstract"),
        publication_year=work.get("publication_year"),
        cited_by_count=work.get("cited_by_count", 0),
        doi=work.get("doi"),
        journal=work.get("journal"),
        authors=work.get("authorships_json", []),
        concepts=work.get("concepts_json", []),
        language=work.get("language"),
        type=work.get("type"),
    )


@router.get("/{work_id}/citations", response_model=CitationGraph)
def get_citations(
    work_id: str,
    direction: str = Query("both", pattern="^(in|out|both)$"),
    limit: int = Query(50, ge=1, le=200),
    conn=Depends(get_conn),
) -> CitationGraph:
    neighbors = get_citation_neighbors(conn, work_id, direction=direction, limit=limit)
    return CitationGraph(
        work_id=work_id,
        citing=[WorkRef(**w) for w in neighbors["citing"]],
        cited=[WorkRef(**w) for w in neighbors["cited"]],
        total_citing=neighbors["total_citing"],
        total_cited=neighbors["total_cited"],
    )


@router.get("/{work_id}/citation-contexts")
def get_citation_contexts(
    work_id: str,
    limit: int = Query(20, ge=1, le=100),
    conn=Depends(get_conn),
) -> dict:
    """Return Semantic Scholar citation contexts for works that cite this paper."""
    rows = conn.execute(
        """SELECT cc.citing_work_id, cc.context_text, cc.section, cc.intent,
                  w.title, w.publication_year
           FROM citation_contexts cc
           LEFT JOIN works w ON cc.citing_work_id = w.work_id
           WHERE cc.cited_work_id = ?
           ORDER BY cc.created_at DESC
           LIMIT ?""",
        [work_id, limit],
    ).fetchall()
    return {
        "work_id": work_id,
        "contexts": [
            {
                "citing_work_id": r[0],
                "context_text": r[1],
                "section": r[2],
                "intent": r[3],
                "citing_title": r[4],
                "citing_year": r[5],
            }
            for r in rows
        ],
    }


@router.get("/{work_id}/similar", response_model=SimilarWorksResponse)
def get_similar_works(
    work_id: str,
    k: int = Query(5, ge=1, le=20),
    conn=Depends(get_conn),
    state: AppState = Depends(get_app_state),
) -> SimilarWorksResponse:
    """Return the k most similar works using ChromaDB cosine similarity."""
    t0 = time.time()

    # Try to get stored embedding from ChromaDB
    embedding = state.vector_store.get_embedding(work_id)

    if embedding is None:
        # Fallback: encode the work text on-the-fly
        work = get_work_by_id(conn, work_id)
        if not work:
            raise HTTPException(status_code=404, detail=f"Work '{work_id}' not found.")
        text = build_searchable_text(work.get("title", ""), work.get("abstract", ""))
        try:
            embedding = state.embedder.encode_query(text)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Embedding unavailable: {exc}") from exc

    # Query ChromaDB for nearest neighbours (fetch k+1 to exclude self)
    hits = state.vector_store.search(embedding, k=k + 1)
    hits = [h for h in hits if h["work_id"] != work_id][:k]

    if not hits:
        return SimilarWorksResponse(work_id=work_id, similar_works=[], latency_ms=0.0)

    hit_ids = [h["work_id"] for h in hits]
    score_map = {h["work_id"]: h["vector_score"] for h in hits}
    works = get_works_by_ids(conn, hit_ids)

    similar = [
        WorkHit(
            work_id=w["work_id"],
            title=w.get("title"),
            abstract=(w.get("abstract") or "")[:250],
            publication_year=w.get("publication_year"),
            cited_by_count=w.get("cited_by_count", 0),
            doi=w.get("doi"),
            journal=w.get("journal"),
            vector_score=score_map.get(w["work_id"]),
            rank=i + 1,
        )
        for i, w in enumerate(works)
    ]

    return SimilarWorksResponse(
        work_id=work_id,
        similar_works=similar,
        latency_ms=round((time.time() - t0) * 1000, 2),
    )


@router.get("/{work_id}/citation-trend")
def citation_trend(work_id: str, conn=Depends(get_conn)) -> list[dict]:
    """Return citing-paper counts grouped by publication year."""
    rows = conn.execute(
        """SELECT w.publication_year, COUNT(*) as count
           FROM citations c
           JOIN works w ON w.work_id = c.citing_work_id
           WHERE c.cited_work_id = ? AND w.publication_year IS NOT NULL
           GROUP BY w.publication_year
           ORDER BY w.publication_year""",
        [work_id],
    ).fetchall()
    return [{"year": r[0], "count": r[1]} for r in rows]


@router.post("/compare")
def compare_works(body: CompareRequest, conn=Depends(get_conn)) -> list[WorkDetail]:
    """Return full details for 2-4 works side-by-side."""
    if len(body.work_ids) < 2 or len(body.work_ids) > 4:
        raise HTTPException(status_code=422, detail="Provide 2-4 work_ids.")
    results = []
    for wid in body.work_ids[:4]:
        work = get_work_by_id(conn, wid)
        if work:
            results.append(WorkDetail(
                work_id=work["work_id"],
                title=work.get("title"),
                abstract=work.get("abstract"),
                publication_year=work.get("publication_year"),
                cited_by_count=work.get("cited_by_count", 0),
                doi=work.get("doi"),
                journal=work.get("journal"),
                authors=work.get("authorships_json", []),
                concepts=work.get("concepts_json", []),
                language=work.get("language"),
                type=work.get("type"),
            ))
    return results
