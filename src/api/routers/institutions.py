"""GET /institutions — institution detail and search."""

from fastapi import APIRouter, Depends, HTTPException, Query

from src.api.dependencies import get_conn
from src.api.schemas.responses import InstitutionDetail
from src.retrieval.duckdb_store import search_institutions

router = APIRouter(prefix="/institutions", tags=["institutions"])


@router.get("/search", response_model=list[InstitutionDetail])
def search_institutions_endpoint(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    conn=Depends(get_conn),
) -> list[InstitutionDetail]:
    rows = search_institutions(conn, q, limit=limit)
    return [InstitutionDetail(**r) for r in rows]


@router.get("/top", response_model=list[InstitutionDetail])
def top_institutions(
    limit: int = Query(20, ge=1, le=100),
    conn=Depends(get_conn),
) -> list[InstitutionDetail]:
    """Most-cited institutions — used for combobox presets and featured cards."""
    cols = ["institution_id", "display_name", "country_code", "type", "works_count", "cited_by_count"]
    rows = conn.execute(
        "SELECT institution_id, display_name, country_code, type, works_count, cited_by_count "
        "FROM institutions ORDER BY cited_by_count DESC NULLS LAST LIMIT ?",
        [limit],
    ).fetchall()
    return [InstitutionDetail(**dict(zip(cols, r))) for r in rows]


@router.get("/{institution_id}", response_model=InstitutionDetail)
def get_institution(institution_id: str, conn=Depends(get_conn)) -> InstitutionDetail:
    row = conn.execute(
        "SELECT institution_id, display_name, country_code, type, works_count, cited_by_count "
        "FROM institutions WHERE institution_id = ?",
        [institution_id],
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Institution '{institution_id}' not found.")
    cols = ["institution_id", "display_name", "country_code", "type", "works_count", "cited_by_count"]
    return InstitutionDetail(**dict(zip(cols, row)))
