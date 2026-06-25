"""GET /authors — author detail, search, and co-author network."""

import json

from fastapi import APIRouter, Depends, HTTPException, Query

from src.api.dependencies import get_conn
from src.api.schemas.responses import AuthorDetail, WorkHit
from src.retrieval.duckdb_store import get_author_works, search_authors

router = APIRouter(prefix="/authors", tags=["authors"])


@router.get("/search", response_model=list[AuthorDetail])
def search_authors_endpoint(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    conn=Depends(get_conn),
) -> list[AuthorDetail]:
    rows = search_authors(conn, q, limit=limit)
    return [
        AuthorDetail(
            author_id=r["author_id"],
            display_name=r["display_name"],
            works_count=r["works_count"],
            cited_by_count=r["cited_by_count"],
            institution_name=r["institution_name"],
        )
        for r in rows
    ]


@router.get("/top", response_model=list[AuthorDetail])
def top_authors(
    limit: int = Query(20, ge=1, le=100),
    conn=Depends(get_conn),
) -> list[AuthorDetail]:
    """Most-cited authors — used for combobox presets and featured cards."""
    rows = conn.execute(
        "SELECT author_id, display_name, works_count, cited_by_count, last_institution_name "
        "FROM authors ORDER BY cited_by_count DESC NULLS LAST LIMIT ?",
        [limit],
    ).fetchall()
    return [
        AuthorDetail(
            author_id=r[0],
            display_name=r[1],
            works_count=r[2],
            cited_by_count=r[3],
            institution_name=r[4],
        )
        for r in rows
    ]


@router.get("/{author_id}", response_model=AuthorDetail)
def get_author(author_id: str, conn=Depends(get_conn)) -> AuthorDetail:
    rows = conn.execute(
        "SELECT author_id, display_name, works_count, cited_by_count, last_institution_name "
        "FROM authors WHERE author_id = ?",
        [author_id],
    ).fetchone()
    if not rows:
        raise HTTPException(status_code=404, detail=f"Author '{author_id}' not found.")
    all_w = get_author_works(conn, author_id, limit=500)
    # Sort all works by cited_by_count desc
    all_w_sorted = sorted(all_w, key=lambda w: w.get("cited_by_count", 0), reverse=True)
    # Compute h-index
    cited_counts = [w.get("cited_by_count", 0) for w in all_w_sorted]
    h_index = sum(1 for i, c in enumerate(cited_counts, 1) if c >= i)
    all_hits = [
        WorkHit(
            work_id=w["work_id"],
            title=w.get("title"),
            publication_year=w.get("publication_year"),
            cited_by_count=w.get("cited_by_count", 0),
            rank=i + 1,
        )
        for i, w in enumerate(all_w_sorted)
    ]
    return AuthorDetail(
        author_id=rows[0],
        display_name=rows[1],
        works_count=rows[2],
        cited_by_count=rows[3],
        institution_name=rows[4],
        h_index=h_index,
        recent_works=all_hits[:10],
        all_works=all_hits,
    )


@router.get("/{author_id}/coauthors")
def get_coauthors(
    author_id: str,
    limit: int = Query(20, ge=1, le=100),
    conn=Depends(get_conn),
) -> dict:
    """Return co-author network nodes and edges for graph visualisation."""
    works = get_author_works(conn, author_id, limit=200)
    work_ids = [w["work_id"] for w in works]
    if not work_ids:
        return {"nodes": [], "edges": []}

    # Fetch full authorships for those works
    placeholders = ", ".join(["?" for _ in work_ids])
    rows = conn.execute(
        f"SELECT work_id, authorships_json FROM works WHERE work_id IN ({placeholders})",
        work_ids,
    ).fetchall()

    coauthor_works: dict[str, list[str]] = {}  # coauthor_id → list of shared work_ids
    coauthor_names: dict[str, str] = {}

    for work_id, auth_json in rows:
        try:
            authorships = json.loads(auth_json or "[]")
        except Exception:
            continue
        for a in authorships:
            raw_id = a.get("author", {}).get("id", "")
            a_id = raw_id.split("/")[-1] if raw_id else ""
            if not a_id or a_id == author_id:
                continue
            coauthor_works.setdefault(a_id, []).append(work_id)
            if a_id not in coauthor_names:
                coauthor_names[a_id] = a.get("author", {}).get("display_name") or a_id

    # Sort by shared work count descending, limit
    sorted_coauthors = sorted(coauthor_works.items(), key=lambda x: len(x[1]), reverse=True)[:limit]

    nodes = [{"id": a_id, "name": coauthor_names.get(a_id, a_id), "shared_works": len(wids)}
             for a_id, wids in sorted_coauthors]
    edges = [{"source": author_id, "target": a_id, "shared_works": len(wids)}
             for a_id, wids in sorted_coauthors]

    return {"nodes": nodes, "edges": edges}
