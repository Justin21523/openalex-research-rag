"""POST /import — import a single paper by DOI or arXiv ID."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Query

from src.api.dependencies import get_app_state, get_conn
from src.api.state import AppState
from src.ingestion.db_writer import write_citations, write_works
from src.ingestion.openalex_client import OpenAlexClient
from src.preprocessing.normalizer import normalize_work

router = APIRouter(prefix="/import", tags=["import"])


def _ingest_one(raw: dict, conn, state: AppState) -> dict:
    """Normalise, upsert to DuckDB, update BM25, embed in ChromaDB."""
    work = normalize_work(raw)
    write_works(conn, [work])
    write_citations(conn, raw)

    # BM25 incremental update
    try:
        if state.bm25_index:
            from src.features.bm25_index import BM25Index
            new_idx = BM25Index().build(conn)
            state.bm25_index._bm25 = new_idx._bm25
            state.bm25_index._work_ids = new_idx._work_ids
    except Exception:
        pass

    # ChromaDB embed
    try:
        from src.preprocessing.text_cleaner import build_searchable_text
        text = build_searchable_text(work.get("title", ""), work.get("abstract", ""))
        emb = state.embedder.encode([text])
        state.vector_store.upsert(
            work_ids=[work["work_id"]],
            embeddings=emb,
            documents=[text],
            metadatas=[{"year": work.get("publication_year") or 0}],
        )
    except Exception:
        pass

    return work


@router.post("/doi")
def import_by_doi(
    doi: str = Query(..., description="e.g. 10.1038/nature12373"),
    conn=Depends(get_conn),
    state: AppState = Depends(get_app_state),
) -> dict:
    """Import a single paper from OpenAlex by DOI."""
    client = OpenAlexClient()
    results, _ = client.get_works_page(filter_str=f"doi:{doi}", per_page=1)
    if not results:
        raise HTTPException(status_code=404, detail=f"No paper found for DOI: {doi}")
    work = _ingest_one(results[0], conn, state)
    return {"imported": True, "work_id": work["work_id"], "title": work.get("title")}


@router.post("/arxiv")
def import_by_arxiv(
    arxiv_id: str = Query(..., description="e.g. 2401.01234 or https://arxiv.org/abs/2401.01234"),
    conn=Depends(get_conn),
    state: AppState = Depends(get_app_state),
) -> dict:
    """Import a single paper from OpenAlex by arXiv ID."""
    # Extract bare ID from URL if needed
    match = re.search(r"(\d{4}\.\d{4,5}(?:v\d+)?)", arxiv_id)
    bare_id = match.group(1) if match else arxiv_id.strip()

    client = OpenAlexClient()
    results, _ = client.get_works_page(
        filter_str=f"locations.landing_page_url:arxiv.org/abs/{bare_id}",
        per_page=1,
    )
    if not results:
        # Try alternative filter
        results, _ = client.get_works_page(
            filter_str=f"doi:10.48550/arXiv.{bare_id}",
            per_page=1,
        )
    if not results:
        raise HTTPException(status_code=404, detail=f"No paper found for arXiv ID: {bare_id}")
    work = _ingest_one(results[0], conn, state)
    return {"imported": True, "work_id": work["work_id"], "title": work.get("title")}
