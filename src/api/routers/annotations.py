"""CRUD endpoints for per-paper annotations (notes)."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.dependencies import get_conn

router = APIRouter(tags=["annotations"])


class AnnotationCreate(BaseModel):
    note_text: str = ""
    highlighted_text: str = ""
    color: str = "yellow"


class AnnotationUpdate(BaseModel):
    note_text: str | None = None
    highlighted_text: str | None = None
    color: str | None = None


class AnnotationOut(BaseModel):
    annotation_id: str
    work_id: str
    note_text: str
    highlighted_text: str
    color: str
    created_at: str
    updated_at: str


@router.get("/works/{work_id}/annotations", response_model=list[AnnotationOut])
def list_annotations(work_id: str, conn=Depends(get_conn)) -> list[AnnotationOut]:
    rows = conn.execute(
        """SELECT annotation_id, work_id, note_text, highlighted_text, color,
                  created_at::VARCHAR, updated_at::VARCHAR
           FROM annotations WHERE work_id = ? ORDER BY created_at DESC""",
        [work_id],
    ).fetchall()
    return [
        AnnotationOut(
            annotation_id=r[0], work_id=r[1], note_text=r[2] or "",
            highlighted_text=r[3] or "", color=r[4] or "yellow",
            created_at=r[5] or "", updated_at=r[6] or "",
        )
        for r in rows
    ]


@router.post("/works/{work_id}/annotations", response_model=AnnotationOut, status_code=201)
def create_annotation(work_id: str, body: AnnotationCreate, conn=Depends(get_conn)) -> AnnotationOut:
    ann_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn.execute(
        """INSERT INTO annotations (annotation_id, work_id, note_text, highlighted_text, color, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [ann_id, work_id, body.note_text, body.highlighted_text, body.color, now, now],
    )
    conn.commit()
    return AnnotationOut(
        annotation_id=ann_id, work_id=work_id,
        note_text=body.note_text, highlighted_text=body.highlighted_text,
        color=body.color, created_at=now, updated_at=now,
    )


@router.put("/annotations/{annotation_id}", response_model=AnnotationOut)
def update_annotation(annotation_id: str, body: AnnotationUpdate, conn=Depends(get_conn)) -> AnnotationOut:
    row = conn.execute(
        "SELECT annotation_id, work_id, note_text, highlighted_text, color, created_at::VARCHAR FROM annotations WHERE annotation_id = ?",
        [annotation_id],
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Annotation not found")

    new_note = body.note_text if body.note_text is not None else row[2]
    new_hl = body.highlighted_text if body.highlighted_text is not None else row[3]
    new_color = body.color if body.color is not None else row[4]
    now = datetime.utcnow().isoformat()

    conn.execute(
        "UPDATE annotations SET note_text=?, highlighted_text=?, color=?, updated_at=? WHERE annotation_id=?",
        [new_note, new_hl, new_color, now, annotation_id],
    )
    conn.commit()
    return AnnotationOut(
        annotation_id=annotation_id, work_id=row[1],
        note_text=new_note, highlighted_text=new_hl, color=new_color,
        created_at=row[5] or "", updated_at=now,
    )


@router.delete("/annotations/{annotation_id}", status_code=200)
def delete_annotation(annotation_id: str, conn=Depends(get_conn)) -> dict:
    result = conn.execute(
        "DELETE FROM annotations WHERE annotation_id = ?", [annotation_id]
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Annotation not found")
    conn.commit()
    return {"deleted": annotation_id}


@router.get("/annotations/all")
def list_all_annotations(
    limit: int = 100,
    conn=Depends(get_conn),
) -> list[dict]:
    """Return all annotations grouped by paper, with paper title and year."""
    rows = conn.execute(
        """SELECT a.annotation_id, a.work_id, a.note_text, a.highlighted_text, a.color,
                  a.created_at::VARCHAR, w.title, w.publication_year
           FROM annotations a
           LEFT JOIN works w ON w.work_id = a.work_id
           ORDER BY a.created_at DESC
           LIMIT ?""",
        [limit],
    ).fetchall()

    # Group by work_id
    papers: dict[str, dict] = {}
    for r in rows:
        wid = r[1]
        if wid not in papers:
            papers[wid] = {
                "work_id": wid,
                "title": r[6] or wid,
                "publication_year": r[7],
                "annotations": [],
            }
        papers[wid]["annotations"].append({
            "annotation_id": r[0],
            "note_text": r[2] or "",
            "highlighted_text": r[3] or "",
            "color": r[4] or "yellow",
            "created_at": r[5] or "",
        })

    return list(papers.values())
