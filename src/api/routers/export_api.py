"""POST /export/works — export selected works as CSV, BibTeX, JSON or Markdown."""

from __future__ import annotations

import csv
import io
import json
import re

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from src.api.dependencies import get_conn
from src.retrieval.duckdb_store import get_work_by_id

router = APIRouter(prefix="/export", tags=["export"])

FORMATS = {"csv", "bibtex", "json", "markdown"}


class ExportRequest(BaseModel):
    work_ids: list[str]
    format: str = "csv"


@router.post("/works")
def export_works(body: ExportRequest, conn=Depends(get_conn)) -> Response:
    """Export a list of works in the requested format."""
    fmt = body.format.lower()
    if fmt not in FORMATS:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail=f"format must be one of {FORMATS}")

    works = [w for wid in body.work_ids if (w := get_work_by_id(conn, wid))]

    if fmt == "csv":
        return _export_csv(works)
    if fmt == "bibtex":
        return _export_bibtex(works)
    if fmt == "json":
        return _export_json(works)
    return _export_markdown(works)


def _export_csv(works: list[dict]) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["work_id", "title", "authors", "year", "doi", "journal", "cited_by_count", "abstract"])
    for w in works:
        authors = _author_names(w.get("authorships_json", []))
        writer.writerow([
            w.get("work_id", ""), w.get("title", ""),
            "; ".join(authors), w.get("publication_year", ""),
            w.get("doi", ""), w.get("journal", ""),
            w.get("cited_by_count", 0),
            (w.get("abstract") or "")[:500],
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=works.csv"},
    )


def _export_bibtex(works: list[dict]) -> Response:
    entries: list[str] = []
    for w in works:
        authors = _author_names(w.get("authorships_json", []))
        first_author = re.sub(r"[^A-Za-z]", "", (authors[0].split()[-1] if authors else "unknown"))
        year = w.get("publication_year") or "unknown"
        key = f"{first_author}{year}"
        title = (w.get("title") or "").replace("{", "").replace("}", "")
        doi = w.get("doi") or ""
        journal = w.get("journal") or ""
        entry = f"""@article{{{key},
  title = {{{title}}},
  author = {{{" and ".join(authors)}}},
  year = {{{year}}},
  doi = {{{doi}}},
  journal = {{{journal}}},
  note = {{{w.get("work_id", "")}}},
}}"""
        entries.append(entry)
    content = "\n\n".join(entries)
    return Response(
        content=content,
        media_type="application/x-bibtex",
        headers={"Content-Disposition": "attachment; filename=works.bib"},
    )


def _export_json(works: list[dict]) -> Response:
    # Sanitise JSON-serialisable output
    clean = []
    for w in works:
        clean.append({
            "work_id": w.get("work_id"),
            "title": w.get("title"),
            "abstract": w.get("abstract"),
            "publication_year": w.get("publication_year"),
            "cited_by_count": w.get("cited_by_count"),
            "doi": w.get("doi"),
            "journal": w.get("journal"),
            "language": w.get("language"),
            "type": w.get("type"),
            "authors": _author_names(w.get("authorships_json", [])),
            "concepts": [c.get("display_name") for c in (w.get("concepts_json") or [])],
        })
    return Response(
        content=json.dumps(clean, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=works.json"},
    )


def _export_markdown(works: list[dict]) -> Response:
    lines: list[str] = ["# Exported Works\n"]
    for w in works:
        authors = _author_names(w.get("authorships_json", []))
        lines.append(f"## {w.get('title') or w.get('work_id')}")
        meta_parts = []
        if authors:
            meta_parts.append(", ".join(authors[:3]) + (" et al." if len(authors) > 3 else ""))
        if w.get("publication_year"):
            meta_parts.append(str(w["publication_year"]))
        if w.get("doi"):
            meta_parts.append(f"DOI: {w['doi']}")
        if meta_parts:
            lines.append("**" + " | ".join(meta_parts) + "**")
        if w.get("abstract"):
            lines.append(f"\n> {w['abstract'][:300]}…\n")
        lines.append("")
    return Response(
        content="\n".join(lines),
        media_type="text/markdown",
        headers={"Content-Disposition": "attachment; filename=works.md"},
    )


def _author_names(authorships) -> list[str]:
    """Extract display names from authorships_json (list of dicts)."""
    if not authorships:
        return []
    names: list[str] = []
    for a in authorships:
        if isinstance(a, dict):
            name = a.get("author", {}).get("display_name") or a.get("display_name") or ""
            if name:
                names.append(name)
    return names


@router.get("/conversation/{session_id}")
def export_conversation(
    session_id: str,
    format: str = Query("markdown", pattern="^(markdown|json)$"),
    conn=Depends(get_conn),
) -> Response:
    """Export a full RAG conversation as Markdown or JSON."""
    rows = conn.execute(
        """SELECT role, content, citations_json, mode, created_at::VARCHAR
           FROM conversation_messages WHERE session_id=? ORDER BY created_at""",
        [session_id],
    ).fetchall()

    if format == "json":
        data = [{"role": r[0], "content": r[1], "citations": json.loads(r[2] or "[]"),
                 "mode": r[3], "timestamp": r[4]} for r in rows]
        return Response(
            content=json.dumps(data, indent=2, ensure_ascii=False),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=conversation_{session_id[:8]}.json"},
        )

    lines = [f"# Conversation {session_id[:8]}\n"]
    for role, content, cit_json, mode, ts in rows:
        prefix = "**You**" if role == "user" else "**Assistant**"
        citations = json.loads(cit_json or "[]")
        cit_str = f" *(citations: {', '.join(citations)})*" if citations else ""
        lines.append(f"{prefix}: {content}{cit_str}\n")
    return Response(
        content="\n".join(lines),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=conversation_{session_id[:8]}.md"},
    )
