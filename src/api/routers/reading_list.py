"""Reading List — bookmark papers with unread/reading/done status."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.api.dependencies import get_conn
from src.retrieval.duckdb_store import get_work_by_id

router = APIRouter(prefix="/reading-list", tags=["reading-list"])


class ReadingListItem(BaseModel):
    work_id: str
    status: str
    added_at: str
    updated_at: str
    title: str | None = None
    publication_year: int | None = None
    journal: str | None = None
    cited_by_count: int = 0
    doi: str | None = None


@router.get("", response_model=list[ReadingListItem])
def list_reading_list(
    status: str | None = Query(None, pattern="^(unread|reading|done)$"),
    conn=Depends(get_conn),
) -> list[ReadingListItem]:
    if status:
        rows = conn.execute(
            """SELECT rl.work_id, rl.status, rl.added_at::VARCHAR, rl.updated_at::VARCHAR,
                      w.title, w.publication_year, w.primary_location_name, w.cited_by_count, w.doi
               FROM reading_list rl LEFT JOIN works w ON rl.work_id = w.work_id
               WHERE rl.status = ? ORDER BY rl.updated_at DESC""",
            [status],
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT rl.work_id, rl.status, rl.added_at::VARCHAR, rl.updated_at::VARCHAR,
                      w.title, w.publication_year, w.primary_location_name, w.cited_by_count, w.doi
               FROM reading_list rl LEFT JOIN works w ON rl.work_id = w.work_id
               ORDER BY rl.updated_at DESC""",
        ).fetchall()
    return [
        ReadingListItem(
            work_id=r[0], status=r[1], added_at=r[2] or "", updated_at=r[3] or "",
            title=r[4], publication_year=r[5], journal=r[6],
            cited_by_count=r[7] or 0, doi=r[8],
        )
        for r in rows
    ]


@router.post("/{work_id}", response_model=ReadingListItem)
def add_to_reading_list(work_id: str, conn=Depends(get_conn)) -> ReadingListItem:
    existing = conn.execute(
        "SELECT status FROM reading_list WHERE work_id = ?", [work_id]
    ).fetchone()
    if existing:
        return ReadingListItem(
            work_id=work_id, status=existing[0],
            added_at="", updated_at="",
        )
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO reading_list (work_id, status, added_at, updated_at) VALUES (?, 'unread', ?, ?)",
        [work_id, now, now],
    )
    conn.commit()
    work = get_work_by_id(conn, work_id)
    return ReadingListItem(
        work_id=work_id, status="unread", added_at=now, updated_at=now,
        title=work.get("title") if work else None,
        publication_year=work.get("publication_year") if work else None,
        journal=work.get("journal") if work else None,
        cited_by_count=work.get("cited_by_count", 0) if work else 0,
        doi=work.get("doi") if work else None,
    )


@router.patch("/{work_id}")
def update_status(
    work_id: str,
    status: str = Query(..., pattern="^(unread|reading|done)$"),
    conn=Depends(get_conn),
) -> dict:
    now = datetime.utcnow().isoformat()
    result = conn.execute(
        "UPDATE reading_list SET status=?, updated_at=? WHERE work_id=?",
        [status, now, work_id],
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Work not in reading list.")
    conn.commit()
    return {"work_id": work_id, "status": status}


@router.delete("/{work_id}")
def remove_from_reading_list(work_id: str, conn=Depends(get_conn)) -> dict:
    result = conn.execute("DELETE FROM reading_list WHERE work_id=?", [work_id])
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Work not in reading list.")
    conn.commit()
    return {"deleted": work_id}


@router.get("/{work_id}/status")
def get_reading_status(work_id: str, conn=Depends(get_conn)) -> dict:
    row = conn.execute(
        "SELECT status FROM reading_list WHERE work_id=?", [work_id]
    ).fetchone()
    return {"work_id": work_id, "status": row[0] if row else None}
