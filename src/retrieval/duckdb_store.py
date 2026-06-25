"""DuckDB query helpers for metadata retrieval."""

import json

import duckdb

from src.utils.logging import get_logger

logger = get_logger(__name__)


def get_works_by_ids(conn: duckdb.DuckDBPyConnection, work_ids: list[str]) -> list[dict]:
    """Fetch core work fields for a list of IDs, preserving order."""
    if not work_ids:
        return []
    placeholders = ", ".join(["?" for _ in work_ids])
    rows = conn.execute(
        f"""
        SELECT work_id, title, abstract, publication_year, cited_by_count,
               doi, primary_location_name, language, type
        FROM works WHERE work_id IN ({placeholders})
        """,
        work_ids,
    ).fetchall()
    cols = ["work_id", "title", "abstract", "publication_year", "cited_by_count", "doi", "journal", "language", "type"]
    by_id = {r[0]: dict(zip(cols, r)) for r in rows}
    # Preserve original ordering
    return [by_id[wid] for wid in work_ids if wid in by_id]


def get_work_by_id(conn: duckdb.DuckDBPyConnection, work_id: str) -> dict | None:
    """Fetch full work record including JSON columns."""
    row = conn.execute(
        """
        SELECT work_id, title, abstract, publication_year, cited_by_count,
               doi, primary_location_name, concepts_json, authorships_json,
               referenced_works_json, language, type
        FROM works WHERE work_id = ?
        """,
        [work_id],
    ).fetchone()
    if not row:
        return None
    cols = [
        "work_id", "title", "abstract", "publication_year", "cited_by_count",
        "doi", "journal", "concepts_json", "authorships_json",
        "referenced_works_json", "language", "type",
    ]
    d = dict(zip(cols, row))
    for key in ("concepts_json", "authorships_json", "referenced_works_json"):
        try:
            d[key] = json.loads(d[key] or "[]")
        except Exception:
            d[key] = []
    return d


def get_citation_neighbors(
    conn: duckdb.DuckDBPyConnection,
    work_id: str,
    direction: str = "both",
    limit: int = 50,
) -> dict:
    """Return citing and/or cited works for a given work."""

    def _fetch(query: str, params: list) -> list[dict]:
        rows = conn.execute(query, params).fetchall()
        return [{"work_id": r[0], "title": r[1], "publication_year": r[2]} for r in rows]

    citing, cited = [], []
    if direction in ("in", "both"):
        citing = _fetch(
            """
            SELECT c.citing_work_id, w.title, w.publication_year
            FROM citations c LEFT JOIN works w ON c.citing_work_id = w.work_id
            WHERE c.cited_work_id = ? LIMIT ?
            """,
            [work_id, limit],
        )
    if direction in ("out", "both"):
        cited = _fetch(
            """
            SELECT c.cited_work_id, w.title, w.publication_year
            FROM citations c LEFT JOIN works w ON c.cited_work_id = w.work_id
            WHERE c.citing_work_id = ? LIMIT ?
            """,
            [work_id, limit],
        )
    return {
        "citing": citing,
        "cited": cited,
        "total_citing": len(citing),
        "total_cited": len(cited),
    }


def get_author_works(
    conn: duckdb.DuckDBPyConnection,
    author_id: str,
    limit: int = 20,
) -> list[dict]:
    """Find works by author_id (Python-side JSON filtering for small corpus)."""
    rows = conn.execute(
        "SELECT work_id, title, publication_year, cited_by_count, authorships_json FROM works"
    ).fetchall()
    results = []
    for work_id, title, year, cites, auth_json in rows:
        try:
            authorships = json.loads(auth_json or "[]")
        except Exception:
            continue
        for auth in authorships:
            raw_id = auth.get("author", {}).get("id", "")
            short_id = raw_id.split("/")[-1] if raw_id else ""
            if short_id == author_id:
                results.append({"work_id": work_id, "title": title, "publication_year": year, "cited_by_count": cites})
                break
    return results[:limit]


def get_topic_trends(
    conn: duckdb.DuckDBPyConnection,
    concept_name: str | None = None,
    year_from: int = 2015,
    year_to: int = 2024,
) -> list[dict]:
    """Return publication count and average citations grouped by year."""
    rows = conn.execute(
        """
        SELECT publication_year, COUNT(*) as count, AVG(cited_by_count) as avg_cited,
               ANY_VALUE(concepts_json) as sample_concepts
        FROM works
        WHERE publication_year BETWEEN ? AND ?
        GROUP BY publication_year
        ORDER BY publication_year
        """,
        [year_from, year_to],
    ).fetchall()

    if not concept_name:
        trend_rows = [
            {"year": year, "count": count, "avg_cited_by_count": round(avg_cited or 0, 2)}
            for year, count, avg_cited, _ in rows
        ]
        # Citation velocity: YoY growth rate of avg citations (rolling 3-year)
        for i, row in enumerate(trend_rows):
            if i >= 2:
                prev = trend_rows[i - 2]["avg_cited_by_count"]
                curr = row["avg_cited_by_count"]
                row["citation_velocity"] = round((curr - prev) / max(prev, 1) * 100, 1)
            else:
                row["citation_velocity"] = None
        return trend_rows

    # For concept filtering, fetch all works in range and filter Python-side
    all_rows = conn.execute(
        "SELECT publication_year, cited_by_count, concepts_json FROM works "
        "WHERE publication_year BETWEEN ? AND ?",
        [year_from, year_to],
    ).fetchall()

    year_data: dict[int, dict] = {}
    for year, cites, concepts_json in all_rows:
        if year is None:
            continue
        try:
            concepts = json.loads(concepts_json or "[]")
        except Exception:
            continue
        names = [c.get("display_name", "").lower() for c in concepts]
        if concept_name.lower() not in " ".join(names):
            continue
        if year not in year_data:
            year_data[year] = {"count": 0, "total_cites": 0}
        year_data[year]["count"] += 1
        year_data[year]["total_cites"] += cites or 0

    return [
        {
            "year": year,
            "count": d["count"],
            "avg_cited_by_count": round(d["total_cites"] / d["count"], 2),
        }
        for year, d in sorted(year_data.items())
    ]


def search_authors(conn: duckdb.DuckDBPyConnection, query: str, limit: int = 10) -> list[dict]:
    """Full-text search over author display_name."""
    rows = conn.execute(
        """
        SELECT author_id, display_name, works_count, cited_by_count,
               last_institution_name
        FROM authors
        WHERE lower(display_name) LIKE lower(?)
        LIMIT ?
        """,
        [f"%{query}%", limit],
    ).fetchall()
    cols = ["author_id", "display_name", "works_count", "cited_by_count", "institution_name"]
    return [dict(zip(cols, r)) for r in rows]


def search_institutions(conn: duckdb.DuckDBPyConnection, query: str, limit: int = 10) -> list[dict]:
    """Full-text search over institution display_name."""
    rows = conn.execute(
        """
        SELECT institution_id, display_name, country_code, type,
               works_count, cited_by_count
        FROM institutions
        WHERE lower(display_name) LIKE lower(?)
        LIMIT ?
        """,
        [f"%{query}%", limit],
    ).fetchall()
    cols = ["institution_id", "display_name", "country_code", "type", "works_count", "cited_by_count"]
    return [dict(zip(cols, r)) for r in rows]


def get_top_concepts(conn: duckdb.DuckDBPyConnection, limit: int = 50) -> list[dict]:
    """Aggregate concept counts across all works (Python-side for portability)."""
    rows = conn.execute("SELECT concepts_json FROM works WHERE concepts_json IS NOT NULL").fetchall()
    counts: dict[str, dict] = {}
    for (concepts_json,) in rows:
        try:
            concepts = json.loads(concepts_json or "[]")
        except Exception:
            continue
        for c in concepts:
            cid = c.get("id", "").split("/")[-1]
            name = c.get("display_name", "")
            if cid and name:
                if cid not in counts:
                    counts[cid] = {"concept_id": cid, "concept_name": name, "work_count": 0}
                counts[cid]["work_count"] += 1
    return sorted(counts.values(), key=lambda x: -x["work_count"])[:limit]


def search_fts(conn: duckdb.DuckDBPyConnection, query: str, k: int = 10) -> list[dict]:
    """Full-text search using DuckDB's built-in FTS extension.

    Requires the FTS index to be built first: run `make index-fts`.
    Returns the same dict format as HybridSearch (work_id, bm25_score, rrf_score, rank).
    """
    try:
        conn.execute("LOAD fts")
        rows = conn.execute(
            """
            SELECT work_id, fts_main_works.match_bm25(work_id, ?) AS score
            FROM works
            WHERE score IS NOT NULL
            ORDER BY score DESC
            LIMIT ?
            """,
            [query, k],
        ).fetchall()
        return [
            {
                "work_id": r[0],
                "bm25_score": float(r[1]),
                "vector_score": None,
                "rrf_score": float(r[1]),
                "rank": i + 1,
            }
            for i, r in enumerate(rows)
            if r[1] is not None
        ]
    except Exception as exc:
        logger.warning("DuckDB FTS search failed (run 'make index-fts' first): %s", exc)
        return []
