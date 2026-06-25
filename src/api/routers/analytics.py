"""GET /analytics — search query analytics from query_logs table."""

from fastapi import APIRouter, Depends, Query

from src.api.dependencies import get_conn

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def analytics_summary(conn=Depends(get_conn)) -> dict:
    """Return aggregate search analytics from query_logs."""
    row = conn.execute(
        "SELECT COUNT(*), ROUND(AVG(latency_ms), 1), ROUND(AVG(results_count), 1) FROM query_logs"
    ).fetchone()
    total_queries = row[0] or 0
    avg_latency = row[1] or 0.0
    avg_results = row[2] or 0.0

    mode_rows = conn.execute(
        "SELECT mode, COUNT(*) AS cnt FROM query_logs GROUP BY mode ORDER BY cnt DESC"
    ).fetchall()
    mode_distribution = {r[0]: r[1] for r in mode_rows if r[0]}

    top_rows = conn.execute(
        """SELECT query_text, COUNT(*) AS cnt
           FROM query_logs
           WHERE query_text IS NOT NULL AND TRIM(query_text) != ''
           GROUP BY query_text
           ORDER BY cnt DESC
           LIMIT 15"""
    ).fetchall()
    top_queries = [{"text": r[0], "count": r[1]} for r in top_rows]

    latency_rows = conn.execute(
        """SELECT CASE
               WHEN latency_ms < 200  THEN '<200ms'
               WHEN latency_ms < 500  THEN '200-500ms'
               WHEN latency_ms < 1000 THEN '500ms-1s'
               ELSE '>1s'
           END AS bucket, COUNT(*) AS cnt
           FROM query_logs
           WHERE latency_ms IS NOT NULL
           GROUP BY bucket"""
    ).fetchall()
    latency_distribution = {r[0]: r[1] for r in latency_rows}

    return {
        "total_queries": total_queries,
        "avg_latency_ms": avg_latency,
        "avg_results_count": avg_results,
        "mode_distribution": mode_distribution,
        "top_queries": top_queries,
        "latency_distribution": latency_distribution,
    }


@router.get("/recent")
def recent_queries(
    limit: int = Query(20, ge=1, le=100),
    conn=Depends(get_conn),
) -> list[dict]:
    """Return most recent search queries."""
    rows = conn.execute(
        """SELECT query_text, mode, results_count, latency_ms, created_at
           FROM query_logs
           WHERE query_text IS NOT NULL
           ORDER BY created_at DESC
           LIMIT ?""",
        [limit],
    ).fetchall()
    return [
        {
            "query_text": r[0],
            "mode": r[1],
            "results_count": r[2],
            "latency_ms": r[3],
            "created_at": str(r[4]) if r[4] else None,
        }
        for r in rows
    ]


@router.get("/year-distribution")
def year_distribution(conn=Depends(get_conn)) -> list[dict]:
    """Return paper count per publication year for corpus overview."""
    rows = conn.execute(
        """SELECT publication_year, COUNT(*) AS count
           FROM works
           WHERE publication_year IS NOT NULL AND publication_year >= 1990
           GROUP BY publication_year
           ORDER BY publication_year"""
    ).fetchall()
    return [{"year": r[0], "count": r[1]} for r in rows]
