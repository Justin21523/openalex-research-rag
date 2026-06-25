"""Playground router — user data upload, index rebuild, evaluation benchmarks."""

from __future__ import annotations

import csv
import io
import json
import statistics
import time
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Body
from fastapi.responses import StreamingResponse

from src.api.schemas.responses import (
    BuildResult,
    EvalModeResult,
    EvaluationResult,
    UploadResult,
)
from src.api.state import get_state
from src.features.bm25_index import BM25Index
from src.ingestion.db_writer import write_works
from src.preprocessing.deduplicator import deduplicate_works
from src.preprocessing.normalizer import normalize_work, normalize_works_batch
from src.preprocessing.text_cleaner import clean_text, reconstruct_abstract
from src.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/playground", tags=["playground"])

# Built-in test queries for evaluation benchmarks
_TEST_QUERIES = [
    "transformer attention mechanism",
    "graph neural network",
    "language model pretraining",
    "reinforcement learning policy",
    "contrastive learning representation",
]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _gen_work_id() -> str:
    return f"W_USER_{uuid.uuid4().hex[:8].upper()}"


def _detect_format(data: object, filename: str = "") -> str:
    """Infer upload format from content or filename."""
    if filename.endswith(".csv"):
        return "csv"
    if isinstance(data, list) and data and isinstance(data[0], dict):
        if "abstract_inverted_index" in data[0]:
            return "openalex_json"
        if "title" in data[0] or "abstract" in data[0]:
            return "simple_json"
    return "unknown"


def _parse_simple_work(raw: dict, idx: int) -> dict:
    """Convert user-provided simple dict to internal works schema."""
    return {
        "work_id": raw.get("id") or raw.get("work_id") or _gen_work_id(),
        "title": raw.get("title", "") or "",
        "abstract": clean_text(raw.get("abstract", "") or raw.get("description", "") or ""),
        "publication_year": raw.get("year") or raw.get("publication_year"),
        "cited_by_count": int(raw.get("citations", 0) or raw.get("cited_by_count", 0) or 0),
        "doi": raw.get("doi", ""),
        "primary_location_name": raw.get("journal", "") or raw.get("venue", "") or "",
        "concepts_json": json.dumps(raw.get("concepts", [])),
        "authorships_json": json.dumps(raw.get("authors", [])),
        "referenced_works_json": json.dumps(raw.get("references", [])),
        "language": raw.get("language", "en"),
        "type": raw.get("type", "article"),
    }


def _parse_csv_works(content: bytes) -> list[dict]:
    """Parse CSV bytes into simple work dicts."""
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    results = []
    for row in reader:
        # Map common column name variants
        title = row.get("title") or row.get("Title") or row.get("TITLE") or ""
        abstract = (row.get("abstract") or row.get("Abstract") or
                    row.get("ABSTRACT") or row.get("description") or "")
        year = row.get("year") or row.get("Year") or row.get("publication_year")
        doi = row.get("doi") or row.get("DOI") or row.get("Doi") or ""
        results.append({
            "title": title.strip(),
            "abstract": abstract.strip(),
            "year": int(year) if year and str(year).isdigit() else None,
            "doi": doi.strip(),
        })
    return results


def _ingest_records(raw_records: list[dict], fmt: str, conn) -> tuple[list[dict], int]:
    """Normalise → deduplicate → write. Returns (normalized_works, skipped_count)."""
    before_count = len(raw_records)

    if fmt == "openalex_json":
        works = normalize_works_batch(raw_records)
    else:
        works = [_parse_simple_work(r, i) for i, r in enumerate(raw_records)]
        works = [w for w in works if w.get("title")]  # drop empty-title rows

    before_dedup = len(works)
    works = deduplicate_works(works)
    skipped = before_dedup - len(works)

    write_works(conn, works)
    return works, skipped


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResult)
async def upload_file(file: UploadFile = File(...)):
    """Accept JSON or CSV file upload and ingest into DuckDB."""
    t0 = time.perf_counter()
    state = get_state()
    content = await file.read()
    filename = file.filename or ""

    try:
        if filename.endswith(".csv"):
            raw = _parse_csv_works(content)
            fmt = "csv"
        else:
            raw = json.loads(content)
            fmt = _detect_format(raw, filename)
            if not isinstance(raw, list):
                raise ValueError("JSON must be an array of works")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse file: {exc}")

    works, skipped = _ingest_records(raw, fmt, state.conn)

    sample = [
        {"work_id": w["work_id"], "title": w.get("title", ""), "year": w.get("publication_year")}
        for w in works[:3]
    ]
    return UploadResult(
        count=len(works),
        format_detected=fmt,
        duplicate_skipped=skipped,
        sample_works=sample,
        latency_ms=(time.perf_counter() - t0) * 1000,
    )


@router.post("/upload-json", response_model=UploadResult)
async def upload_json(body: dict = Body(...)):
    """Accept JSON body {works: [...]} and ingest into DuckDB."""
    t0 = time.perf_counter()
    state = get_state()
    raw = body.get("works", [])
    if not isinstance(raw, list):
        raise HTTPException(status_code=422, detail="'works' must be a list")

    fmt = _detect_format(raw)
    works, skipped = _ingest_records(raw, fmt, state.conn)

    sample = [
        {"work_id": w["work_id"], "title": w.get("title", ""), "year": w.get("publication_year")}
        for w in works[:3]
    ]
    return UploadResult(
        count=len(works),
        format_detected=fmt,
        duplicate_skipped=skipped,
        sample_works=sample,
        latency_ms=(time.perf_counter() - t0) * 1000,
    )


@router.post("/use-sample", response_model=UploadResult)
async def use_sample_data():
    """Load the built-in sample data into DuckDB (idempotent)."""
    from src.ingestion.sample_loader import load_works_sample
    t0 = time.perf_counter()
    state = get_state()

    raw = load_works_sample()
    works = normalize_works_batch(raw)
    works = deduplicate_works(works)
    write_works(state.conn, works)

    sample = [
        {"work_id": w["work_id"], "title": w.get("title", ""), "year": w.get("publication_year")}
        for w in works[:3]
    ]
    return UploadResult(
        count=len(works),
        format_detected="openalex_json",
        duplicate_skipped=0,
        sample_works=sample,
        latency_ms=(time.perf_counter() - t0) * 1000,
    )


@router.post("/build-bm25", response_model=BuildResult)
async def build_bm25():
    """Rebuild BM25 index from current DuckDB works table."""
    t0 = time.perf_counter()
    state = get_state()

    try:
        new_bm25 = BM25Index().build(state.conn)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Update state in-place so hybrid search picks up new index
    state.bm25_index._bm25 = new_bm25._bm25
    state.bm25_index._work_ids = new_bm25._work_ids

    vocab_size = len(state.bm25_index._bm25.idf) if state.bm25_index._bm25 else 0

    return BuildResult(
        index_type="bm25",
        doc_count=new_bm25.doc_count,
        extra={"vocab_size": vocab_size},
        build_time_ms=(time.perf_counter() - t0) * 1000,
    )


@router.post("/build-embeddings")
async def build_embeddings():
    """Stream vector embedding build progress as SSE."""
    state = get_state()

    async def _generate() -> AsyncGenerator[str, None]:
        t0 = time.perf_counter()
        try:
            rows = state.conn.execute(
                "SELECT work_id, title, abstract, publication_year, cited_by_count, primary_location_name FROM works"
            ).fetchall()

            if not rows:
                yield f"data: {json.dumps({'error': 'No works in DuckDB'})}\n\n"
                return

            total = len(rows)
            batch_size = 32
            embedded = 0

            from src.preprocessing.text_cleaner import build_searchable_text

            for start in range(0, total, batch_size):
                batch = rows[start:start + batch_size]
                work_ids = [r[0] for r in batch]
                texts = [build_searchable_text(r[1] or "", r[2] or "") for r in batch]
                metadatas = [{"year": r[3] or 0, "cited_by_count": r[4] or 0, "journal": r[5] or ""} for r in batch]

                embeddings = state.embedder.encode(texts, batch_size=batch_size)
                state.vector_store.upsert(
                    work_ids=work_ids,
                    embeddings=embeddings,
                    documents=texts,
                    metadatas=metadatas,
                )
                embedded += len(batch)
                progress = {"done": embedded, "total": total}
                yield f"data: {json.dumps(progress)}\n\n"

            elapsed = (time.perf_counter() - t0) * 1000
            embedding_dim = len(state.embedder.encode(["test"])[0])
            yield f"data: {json.dumps({'finished': True, 'embedded_count': embedded, 'build_time_ms': round(elapsed, 1), 'embedding_dim': embedding_dim})}\n\n"

        except Exception as exc:
            logger.exception("Error during embedding build: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/build-fts", response_model=BuildResult)
async def build_fts():
    """Build DuckDB native FTS index."""
    t0 = time.perf_counter()
    state = get_state()

    try:
        state.conn.execute("INSTALL fts; LOAD fts")
        state.conn.execute(
            "PRAGMA create_fts_index('works', 'work_id', 'title', 'abstract', overwrite=1)"
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"FTS build failed: {exc}")

    doc_count = state.conn.execute("SELECT COUNT(*) FROM works").fetchone()[0]
    return BuildResult(
        index_type="fts",
        doc_count=doc_count,
        extra={},
        build_time_ms=(time.perf_counter() - t0) * 1000,
    )


@router.post("/evaluate", response_model=EvaluationResult)
async def evaluate(body: dict = Body(default={})):
    """Benchmark all search modes with latency measurements."""
    state = get_state()
    queries = body.get("queries") or _TEST_QUERIES

    if not state.bm25_index or state.bm25_index.doc_count == 0:
        raise HTTPException(status_code=400, detail="BM25 index not built yet")

    modes_to_test = ["bm25", "hybrid"]
    if state.vector_store and state.vector_store.count() > 0:
        modes_to_test.append("vector")

    mode_results: dict[str, EvalModeResult] = {}
    REPEATS = 3

    for mode in modes_to_test:
        latencies = []
        result_counts = []
        for q in queries:
            for _ in range(REPEATS):
                t0 = time.perf_counter()
                try:
                    hits = state.hybrid_search.search(q, k=10, mode=mode)
                    latencies.append((time.perf_counter() - t0) * 1000)
                    result_counts.append(len(hits))
                except Exception:
                    pass

        if latencies:
            sorted_l = sorted(latencies)
            n = len(sorted_l)
            mode_results[mode] = EvalModeResult(
                latency_p50_ms=round(sorted_l[n // 2], 2),
                latency_p99_ms=round(sorted_l[min(int(n * 0.99), n - 1)], 2),
                latency_mean_ms=round(statistics.mean(latencies), 2),
                avg_result_count=round(statistics.mean(result_counts), 1),
            )

    corpus_total = state.conn.execute("SELECT COUNT(*) FROM works").fetchone()[0]
    user_uploaded = state.conn.execute(
        "SELECT COUNT(*) FROM works WHERE work_id LIKE 'W_USER_%'"
    ).fetchone()[0]

    return EvaluationResult(
        modes=mode_results,
        corpus_total=corpus_total,
        user_uploaded=user_uploaded,
        queries_run=len(queries),
        test_queries=list(queries),
    )


@router.post("/clear")
async def clear_user_data():
    """Remove user-uploaded works and rebuild BM25."""
    state = get_state()

    result = state.conn.execute(
        "DELETE FROM works WHERE work_id LIKE 'W_USER_%' RETURNING work_id"
    ).fetchall()
    cleared = len(result)
    state.conn.commit()

    if cleared > 0:
        try:
            new_bm25 = BM25Index().build(state.conn)
            state.bm25_index._bm25 = new_bm25._bm25
            state.bm25_index._work_ids = new_bm25._work_ids
        except RuntimeError:
            pass  # No works left

    return {"cleared": cleared, "message": f"Removed {cleared} user-uploaded works"}


@router.post("/fetch-arxiv-pdfs")
async def trigger_arxiv_fetch(
    limit: int = Query(500, ge=1, le=5000, description="Max papers to fetch PDFs for"),
):
    """Trigger background arXiv PDF full-text fetch."""
    import threading
    import duckdb as _duckdb
    from src.ingestion.arxiv_pdf_fetcher import fetch_and_store_full_texts
    from src.utils.paths import DUCKDB_PATH

    def _run():
        conn = _duckdb.connect(str(DUCKDB_PATH))
        try:
            fetch_and_store_full_texts(conn, limit_works=limit)
        finally:
            conn.close()

    threading.Thread(target=_run, daemon=True).start()

    state = get_state()
    arxiv_count = state.conn.execute(
        "SELECT COUNT(*) FROM works WHERE doi LIKE '10.48550/arXiv.%' OR doi ILIKE '%arxiv%'"
    ).fetchone()[0]
    full_text_count = state.conn.execute(
        "SELECT COUNT(*) FROM works WHERE full_text IS NOT NULL AND full_text != ''"
    ).fetchone()[0]
    return {
        "started": True,
        "limit": limit,
        "arxiv_papers": arxiv_count,
        "already_fetched": full_text_count,
    }


@router.get("/stats")
async def get_stats():
    """Return current corpus and index statistics."""
    state = get_state()
    total = state.conn.execute("SELECT COUNT(*) FROM works").fetchone()[0]
    user_count = state.conn.execute(
        "SELECT COUNT(*) FROM works WHERE work_id LIKE 'W_USER_%'"
    ).fetchone()[0]
    avg_title_len = state.conn.execute(
        "SELECT AVG(LENGTH(title)) FROM works WHERE title IS NOT NULL"
    ).fetchone()[0] or 0

    return {
        "corpus_total": total,
        "user_uploaded": user_count,
        "sample_data": total - user_count,
        "avg_title_length": round(avg_title_len, 1),
        "bm25_doc_count": state.bm25_index.doc_count if state.bm25_index else 0,
        "bm25_vocab_size": len(state.bm25_index._bm25.idf) if state.bm25_index and state.bm25_index._bm25 else 0,
        "vector_count": state.vector_store.count() if state.vector_store else 0,
    }
