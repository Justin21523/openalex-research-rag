"""GET /topics — topic trends, concept stats, heatmap, and cluster."""

import json
import time
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Query

from src.api.dependencies import get_app_state, get_conn
from src.api.schemas.responses import ConceptStats, TopicTrend
from src.api.state import AppState
from src.retrieval.duckdb_store import get_top_concepts, get_topic_trends

router = APIRouter(prefix="/topics", tags=["topics"])

BROAD_CONCEPTS = {
    "Computer science", "Mathematics", "Philosophy", "Biology", "Physics",
    "Chemistry", "Medicine", "Law", "Psychology", "Archaeology", "Geography",
    "Political science", "Sociology", "Economics", "Engineering",
}

# ── Cluster cache (UMAP heavy) ────────────────────────────────────────────────
_cluster_cache: tuple[float, list[dict]] | None = None
_CLUSTER_TTL = 600  # 10 minutes

# ── General warmup cache for expensive aggregations ───────────────────────────
_warmup_cache: dict[str, dict] = {}
_WARMUP_TTL = 3600  # 1 hour


def _cache_get(key: str):
    entry = _warmup_cache.get(key)
    if entry and (time.time() - entry["ts"]) < _WARMUP_TTL:
        return entry["data"]
    return None


def _cache_set(key: str, data) -> None:
    _warmup_cache[key] = {"ts": time.time(), "data": data}


def _specific_top_concepts(conn, limit: int) -> list[dict]:
    """Top concepts suitable for demo charts: skip broad level-0 disciplines."""
    rows = conn.execute(
        """
        SELECT concepts_json
        FROM works
        WHERE concepts_json IS NOT NULL AND TRIM(concepts_json) != ''
        """
    ).fetchall()
    counts: dict[str, dict] = {}
    for (concepts_json,) in rows:
        try:
            concepts = json.loads(concepts_json or "[]")
        except Exception:
            continue
        for c in concepts:
            if not isinstance(c, dict):
                continue
            name = c.get("display_name") or ""
            level = c.get("level")
            if not name or name in BROAD_CONCEPTS:
                continue
            if level is not None and int(level) == 0:
                continue
            cid = (c.get("id") or name).split("/")[-1]
            entry = counts.setdefault(cid, {"concept_id": cid, "concept_name": name, "work_count": 0})
            entry["work_count"] += 1
    return sorted(counts.values(), key=lambda r: r["work_count"], reverse=True)[:limit]


@router.get("/trends", response_model=list[TopicTrend])
def topic_trends(
    concept: str | None = Query(None),
    year_from: int = Query(2015, ge=1990),
    year_to: int = Query(2024, le=2030),
    conn=Depends(get_conn),
) -> list[TopicTrend]:
    rows = get_topic_trends(conn, concept_name=concept, year_from=year_from, year_to=year_to)
    return [TopicTrend(**r) for r in rows]


@router.get("/concepts", response_model=list[ConceptStats])
def top_concepts(
    limit: int = Query(50, ge=1, le=200),
    specific: bool = Query(True, description="Prefer specific concepts over broad level-0 disciplines."),
    conn=Depends(get_conn),
) -> list[ConceptStats]:
    cache_key = f"concepts:{limit}:{specific}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    rows = _specific_top_concepts(conn, limit=limit) if specific else get_top_concepts(conn, limit=limit)
    result = [ConceptStats(**r) for r in rows]
    _cache_set(cache_key, result)
    return result


@router.get("/heatmap")
def concept_heatmap(
    top_n: int = Query(15, ge=3, le=30),
    year_from: int = Query(2015, ge=1990),
    year_to: int = Query(2024, le=2030),
    conn=Depends(get_conn),
) -> dict:
    """Return a concepts × years publication count matrix for heatmap rendering.

    Response shape:
      {concepts: [str], years: [int], matrix: [[int]]}
    """
    cache_key = f"heatmap:{top_n}:{year_from}:{year_to}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    # Get top concepts by work count, excluding broad level-0 disciplines.
    top_concepts_rows = _specific_top_concepts(conn, limit=top_n)
    concept_names = [r["concept_name"] for r in top_concepts_rows]

    years = list(range(year_from, year_to + 1))
    matrix: list[list[int]] = [[0] * len(years) for _ in concept_names]

    # Pull all works in year range
    all_rows = conn.execute(
        "SELECT publication_year, concepts_json FROM works WHERE publication_year BETWEEN ? AND ?",
        [year_from, year_to],
    ).fetchall()

    concept_lower = [c.lower() for c in concept_names]
    year_idx = {y: i for i, y in enumerate(years)}

    for pub_year, concepts_json in all_rows:
        if pub_year is None or pub_year not in year_idx:
            continue
        try:
            concepts = json.loads(concepts_json or "[]")
        except Exception:
            continue
        yi = year_idx[pub_year]
        for c in concepts:
            name = (c.get("display_name") or "").lower()
            if name in concept_lower:
                ci = concept_lower.index(name)
                matrix[ci][yi] += 1

    result = {"concepts": concept_names, "years": years, "matrix": matrix}
    _cache_set(cache_key, result)
    return result


@router.get("/journals")
def journal_stats(
    limit: int = Query(30, ge=5, le=100),
    sort_by: str = Query("paper_count", pattern="^(paper_count|avg_citations)$"),
    conn=Depends(get_conn),
) -> list[dict]:
    """Return top journals by paper count and average citation count."""
    cache_key = f"journals:{limit}:{sort_by}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    order = "paper_count DESC" if sort_by == "paper_count" else "avg_citations DESC"
    rows = conn.execute(
        f"""SELECT primary_location_name AS journal,
                   COUNT(*) AS paper_count,
                   ROUND(AVG(cited_by_count), 1) AS avg_citations,
                   MAX(cited_by_count) AS max_citations
            FROM works
            WHERE primary_location_name IS NOT NULL AND TRIM(primary_location_name) != ''
            GROUP BY journal
            ORDER BY {order}
            LIMIT ?""",
        [limit],
    ).fetchall()
    result = [
        {"journal": r[0], "paper_count": r[1], "avg_citations": r[2], "max_citations": r[3]}
        for r in rows
    ]
    _cache_set(cache_key, result)
    return result


@router.get("/timeline")
def paper_timeline(
    year: int = Query(..., ge=1990, le=2030),
    concept: str | None = Query(None),
    limit: int = Query(20, ge=5, le=100),
    conn=Depends(get_conn),
) -> list[dict]:
    """Return top-cited papers for a given year, optionally filtered by concept."""
    cache_key = f"timeline:{year}:{concept}:{limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if concept:
        rows = conn.execute(
            """SELECT work_id, title, cited_by_count, publication_year, concepts_json
               FROM works
               WHERE publication_year = ? AND concepts_json ILIKE ?
               ORDER BY cited_by_count DESC LIMIT ?""",
            [year, f"%{concept}%", limit],
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT work_id, title, cited_by_count, publication_year, concepts_json
               FROM works
               WHERE publication_year = ?
               ORDER BY cited_by_count DESC LIMIT ?""",
            [year, limit],
        ).fetchall()

    result = []
    for r in rows:
        try:
            concepts = json.loads(r[4] or "[]")
            top_concept = concepts[0]["display_name"] if concepts else None
        except Exception:
            top_concept = None
        result.append({
            "work_id": r[0],
            "title": r[1],
            "cited_by_count": r[2] or 0,
            "publication_year": r[3],
            "top_concept": top_concept,
        })

    _cache_set(cache_key, result)
    return result


@router.get("/cluster")
def concept_cluster(
    top_n: int = Query(3000, ge=100, le=10000),
    state: AppState = Depends(get_app_state),
    conn=Depends(get_conn),
) -> dict:
    """Return 2D UMAP coordinates for papers (uses ChromaDB embeddings)."""
    global _cluster_cache
    now = time.time()
    if _cluster_cache is not None and (now - _cluster_cache[0]) < _CLUSTER_TTL:
        cached_data = _cluster_cache[1]
        if len(cached_data) > 0:
            return {"points": cached_data, "count": len(cached_data), "cached": True}

    try:
        import numpy as np
        import umap
    except ImportError:
        raise HTTPException(status_code=503, detail="umap-learn not installed.")

    work_ids, embeddings = state.vector_store.get_all_embeddings(limit=top_n)
    if len(work_ids) < 10:
        raise HTTPException(status_code=400, detail="Not enough embeddings in ChromaDB.")

    emb_array = np.array(embeddings, dtype=np.float32)
    reducer = umap.UMAP(n_components=2, n_neighbors=15, min_dist=0.1, metric="cosine", random_state=42)
    coords = reducer.fit_transform(emb_array)

    # Fetch metadata from DuckDB
    placeholders = ",".join(["?" for _ in work_ids])
    rows = conn.execute(
        f"SELECT work_id, title, publication_year, concepts_json FROM works WHERE work_id IN ({placeholders})",
        work_ids,
    ).fetchall()
    meta = {r[0]: {"title": r[1], "year": r[2], "concepts_json": r[3]} for r in rows}

    points = []
    for i, wid in enumerate(work_ids):
        m = meta.get(wid, {})
        # Extract top concept
        try:
            concepts = json.loads(m.get("concepts_json") or "[]")
            top_concept = concepts[0]["display_name"] if concepts else "Unknown"
        except Exception:
            top_concept = "Unknown"
        points.append({
            "work_id": wid,
            "x": float(coords[i, 0]),
            "y": float(coords[i, 1]),
            "title": (m.get("title") or "")[:80],
            "year": m.get("year"),
            "concept": top_concept,
        })

    _cluster_cache = (now, points)
    return {"points": points, "count": len(points), "cached": False}
