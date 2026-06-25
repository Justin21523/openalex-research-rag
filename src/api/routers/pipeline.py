"""GET /pipeline/trace — expose all intermediate pipeline stages for visualization."""

import json
import time
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from src.api.dependencies import get_app_state, get_conn
from src.api.schemas.responses import (
    AnswerInfo,
    BM25StageInfo,
    BM25TokenInfo,
    HybridStageInfo,
    PipelineTraceResponse,
    RagContextInfo,
    SampleWork,
    TextCleaningInfo,
    VectorStageInfo,
    WorkHit,
)
from src.api.state import AppState
from src.preprocessing.text_cleaner import build_searchable_text, clean_for_bm25
from src.retrieval.duckdb_store import get_works_by_ids

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.get("/trace", response_model=PipelineTraceResponse)
def pipeline_trace(
    q: str = Query(..., min_length=1, description="Query to trace through the full pipeline"),
    top_k: int = Query(5, ge=1, le=10),
    conn=Depends(get_conn),
    state: AppState = Depends(get_app_state),
) -> PipelineTraceResponse:
    """Run a complete pipeline trace and return all intermediate stage data for visualization."""
    if state.hybrid_search is None:
        raise HTTPException(status_code=503, detail="Search index not initialised.")

    latencies: dict[str, float] = {}

    # ── Stage 1: Sample raw work ───────────────────────────────────────────────
    row = conn.execute(
        """
        SELECT work_id, title, abstract, publication_year,
               concepts_json, referenced_works_json
        FROM works
        ORDER BY random()
        LIMIT 1
        """
    ).fetchone()

    if row:
        concepts = json.loads(row[4]) if isinstance(row[4], str) else (row[4] or [])
        refs = json.loads(row[5]) if isinstance(row[5], str) else (row[5] or [])
        sample_work = SampleWork(
            work_id=row[0],
            title=row[1],
            abstract_preview=(row[2] or "")[:400],
            concepts_preview=[
                c.get("display_name", "") for c in concepts[:6] if isinstance(c, dict)
            ],
            referenced_works_count=len(refs),
            publication_year=row[3],
        )
    else:
        sample_work = SampleWork(
            work_id="N/A",
            title="No works in database",
            abstract_preview="",
            concepts_preview=[],
            referenced_works_count=0,
            publication_year=None,
        )

    # ── Stage 2: Text cleaning ─────────────────────────────────────────────────
    raw_title = sample_work.title or ""
    clean_title = clean_for_bm25(raw_title)
    query_tokens = [t for t in clean_for_bm25(q).split() if t]
    searchable = build_searchable_text(raw_title, sample_work.abstract_preview)
    text_cleaning = TextCleaningInfo(
        raw_title=raw_title,
        clean_title=clean_title,
        query_tokens=query_tokens,
        searchable_text_preview=searchable[:300],
    )

    # ── Stage 3: BM25 ─────────────────────────────────────────────────────────
    t0 = time.time()
    bm25_raw = state.hybrid_search.search(q, k=top_k, mode="bm25")
    latencies["bm25"] = round((time.time() - t0) * 1000, 2)

    bm25_idf: dict = {}
    if state.bm25_index and state.bm25_index._bm25:
        bm25_idf = getattr(state.bm25_index._bm25, "idf", {})

    bm25_hit_ids = [h["work_id"] for h in bm25_raw]
    bm25_meta = {w["work_id"]: w for w in get_works_by_ids(conn, bm25_hit_ids)}
    bm25_results = [
        WorkHit(
            work_id=h["work_id"],
            title=bm25_meta.get(h["work_id"], {}).get("title"),
            bm25_score=h.get("bm25_score"),
            rank=h.get("rank", i + 1),
        )
        for i, h in enumerate(bm25_raw)
    ]
    bm25_stage = BM25StageInfo(
        query_tokens=query_tokens,
        token_info=[
            BM25TokenInfo(token=tok, idf_score=round(float(bm25_idf.get(tok, 0.0)), 4))
            for tok in query_tokens
        ],
        corpus_size=state.bm25_index.doc_count if state.bm25_index else 0,
        results=bm25_results,
    )

    # ── Stage 4: Vector embedding ──────────────────────────────────────────────
    t1 = time.time()
    vec_raw = state.hybrid_search.search(q, k=top_k, mode="vector")
    latencies["vector"] = round((time.time() - t1) * 1000, 2)

    embedding = state.embedder.encode_query(q)
    vec_hit_ids = [h["work_id"] for h in vec_raw]
    vec_meta = {w["work_id"]: w for w in get_works_by_ids(conn, vec_hit_ids)}
    vec_results = [
        WorkHit(
            work_id=h["work_id"],
            title=vec_meta.get(h["work_id"], {}).get("title"),
            vector_score=h.get("vector_score"),
            rank=h.get("rank", i + 1),
        )
        for i, h in enumerate(vec_raw)
    ]
    vector_stage = VectorStageInfo(
        embedding_dim=len(embedding),
        embedding_sample=[round(float(v), 6) for v in embedding[:40]],
        model_name="all-MiniLM-L6-v2",
        results=vec_results,
    )

    # ── Stage 5: Hybrid RRF ────────────────────────────────────────────────────
    t2 = time.time()
    hybrid_raw = state.hybrid_search.search(q, k=top_k, mode="hybrid")
    latencies["hybrid"] = round((time.time() - t2) * 1000, 2)

    hybrid_hit_ids = [h["work_id"] for h in hybrid_raw]
    hybrid_meta = {w["work_id"]: w for w in get_works_by_ids(conn, hybrid_hit_ids)}
    hybrid_results = [
        WorkHit(
            work_id=h["work_id"],
            title=hybrid_meta.get(h["work_id"], {}).get("title"),
            bm25_score=h.get("bm25_score"),
            vector_score=h.get("vector_score"),
            rrf_score=h.get("rrf_score"),
            rank=h.get("rank", i + 1),
        )
        for i, h in enumerate(hybrid_raw)
    ]
    hybrid_stage = HybridStageInfo(rrf_k=60, results=hybrid_results)

    # ── Stage 6: RAG context ───────────────────────────────────────────────────
    t3 = time.time()
    context_works_raw = get_works_by_ids(conn, hybrid_hit_ids)
    context_str = state.rag_pipeline._build_context(context_works_raw)
    latencies["context"] = round((time.time() - t3) * 1000, 2)

    rag_context = RagContextInfo(
        context_preview=context_str[:600],
        context_char_length=len(context_str),
        estimated_tokens=len(context_str) // 4,
        works_used=[
            WorkHit(
                work_id=w["work_id"],
                title=w.get("title"),
                publication_year=w.get("publication_year"),
                cited_by_count=w.get("cited_by_count", 0),
                rank=i + 1,
            )
            for i, w in enumerate(context_works_raw)
        ],
    )

    # ── Stage 7: Extractive answer ─────────────────────────────────────────────
    t4 = time.time()
    ans = state.rag_pipeline.answer_extractive(q)
    latencies["answer"] = round((time.time() - t4) * 1000, 2)

    answer = AnswerInfo(
        answer_text=ans.answer_text,
        citations=ans.citations,
        mode=ans.mode,
        latency_ms=ans.latency_ms,
    )

    return PipelineTraceResponse(
        query=q,
        sample_work=sample_work,
        text_cleaning=text_cleaning,
        bm25=bm25_stage,
        vector=vector_stage,
        hybrid=hybrid_stage,
        rag_context=rag_context,
        answer=answer,
        latencies_ms=latencies,
    )


@router.post("/trace/stream")
async def pipeline_trace_stream(
    q: str = Query(..., min_length=1),
    top_k: int = Query(5, ge=1, le=10),
    conn=Depends(get_conn),
    state: AppState = Depends(get_app_state),
):
    """Stream pipeline trace stage-by-stage as SSE events.

    Events: {"stage": "<key>", "data": {...}}
    Final:  {"stage": "done", "latencies_ms": {...}}
    """
    if state.hybrid_search is None:
        raise HTTPException(status_code=503, detail="Search index not initialised.")

    async def _gen() -> AsyncGenerator[str, None]:
        latencies: dict[str, float] = {}

        try:
            # ── Stage 0: Raw sample work ────────────────────────────────────────
            row = conn.execute(
                "SELECT work_id, title, abstract, publication_year, concepts_json, referenced_works_json "
                "FROM works ORDER BY random() LIMIT 1"
            ).fetchone()
            if row:
                concepts = json.loads(row[4]) if isinstance(row[4], str) else (row[4] or [])
                refs = json.loads(row[5]) if isinstance(row[5], str) else (row[5] or [])
                sw = SampleWork(
                    work_id=row[0], title=row[1],
                    abstract_preview=(row[2] or "")[:400],
                    concepts_preview=[c.get("display_name", "") for c in concepts[:6] if isinstance(c, dict)],
                    referenced_works_count=len(refs),
                    publication_year=row[3],
                )
            else:
                sw = SampleWork(work_id="N/A", title="No works", abstract_preview="",
                                concepts_preview=[], referenced_works_count=0, publication_year=None)
            yield f"data: {json.dumps({'stage': 'sample_work', 'data': sw.model_dump()})}\n\n"

            # ── Stage 1: Text cleaning ──────────────────────────────────────────
            raw_title = sw.title or ""
            clean_title = clean_for_bm25(raw_title)
            query_tokens = [t for t in clean_for_bm25(q).split() if t]
            searchable = build_searchable_text(raw_title, sw.abstract_preview)
            tc = TextCleaningInfo(
                raw_title=raw_title, clean_title=clean_title,
                query_tokens=query_tokens, searchable_text_preview=searchable[:300],
            )
            yield f"data: {json.dumps({'stage': 'text_cleaning', 'data': tc.model_dump()})}\n\n"

            # ── Stage 2: BM25 ───────────────────────────────────────────────────
            t0 = time.time()
            bm25_raw = state.hybrid_search.search(q, k=top_k, mode="bm25")
            latencies["bm25"] = round((time.time() - t0) * 1000, 2)
            bm25_idf = getattr(state.bm25_index._bm25, "idf", {}) if state.bm25_index and state.bm25_index._bm25 else {}
            bm25_hit_ids = [h["work_id"] for h in bm25_raw]
            bm25_meta = {w["work_id"]: w for w in get_works_by_ids(conn, bm25_hit_ids)}
            bm25_stage = BM25StageInfo(
                query_tokens=query_tokens,
                token_info=[BM25TokenInfo(token=tok, idf_score=round(float(bm25_idf.get(tok, 0.0)), 4)) for tok in query_tokens],
                corpus_size=state.bm25_index.doc_count if state.bm25_index else 0,
                results=[WorkHit(work_id=h["work_id"], title=bm25_meta.get(h["work_id"], {}).get("title"),
                                 bm25_score=h.get("bm25_score"), rank=h.get("rank", i + 1))
                         for i, h in enumerate(bm25_raw)],
            )
            yield f"data: {json.dumps({'stage': 'bm25', 'data': bm25_stage.model_dump()})}\n\n"

            # ── Stage 3: Vector ─────────────────────────────────────────────────
            t1 = time.time()
            vec_raw = state.hybrid_search.search(q, k=top_k, mode="vector")
            latencies["vector"] = round((time.time() - t1) * 1000, 2)
            embedding = state.embedder.encode_query(q)
            vec_hit_ids = [h["work_id"] for h in vec_raw]
            vec_meta = {w["work_id"]: w for w in get_works_by_ids(conn, vec_hit_ids)}
            vector_stage = VectorStageInfo(
                embedding_dim=len(embedding),
                embedding_sample=[round(float(v), 6) for v in embedding[:40]],
                model_name="all-MiniLM-L6-v2",
                results=[WorkHit(work_id=h["work_id"], title=vec_meta.get(h["work_id"], {}).get("title"),
                                 vector_score=h.get("vector_score"), rank=h.get("rank", i + 1))
                         for i, h in enumerate(vec_raw)],
            )
            yield f"data: {json.dumps({'stage': 'vector', 'data': vector_stage.model_dump()})}\n\n"

            # ── Stage 4: Hybrid RRF ─────────────────────────────────────────────
            t2 = time.time()
            hybrid_raw = state.hybrid_search.search(q, k=top_k, mode="hybrid")
            latencies["hybrid"] = round((time.time() - t2) * 1000, 2)
            hybrid_hit_ids = [h["work_id"] for h in hybrid_raw]
            hybrid_meta = {w["work_id"]: w for w in get_works_by_ids(conn, hybrid_hit_ids)}
            hybrid_stage = HybridStageInfo(
                rrf_k=60,
                results=[WorkHit(work_id=h["work_id"], title=hybrid_meta.get(h["work_id"], {}).get("title"),
                                 bm25_score=h.get("bm25_score"), vector_score=h.get("vector_score"),
                                 rrf_score=h.get("rrf_score"), rank=h.get("rank", i + 1))
                         for i, h in enumerate(hybrid_raw)],
            )
            yield f"data: {json.dumps({'stage': 'hybrid', 'data': hybrid_stage.model_dump()})}\n\n"

            # ── Stage 5: RAG context ────────────────────────────────────────────
            t3 = time.time()
            context_works_raw = get_works_by_ids(conn, hybrid_hit_ids)
            context_str = state.rag_pipeline._build_context(context_works_raw)
            latencies["context"] = round((time.time() - t3) * 1000, 2)
            rag_context = RagContextInfo(
                context_preview=context_str[:600],
                context_char_length=len(context_str),
                estimated_tokens=len(context_str) // 4,
                works_used=[WorkHit(work_id=w["work_id"], title=w.get("title"),
                                    publication_year=w.get("publication_year"),
                                    cited_by_count=w.get("cited_by_count", 0), rank=i + 1)
                            for i, w in enumerate(context_works_raw)],
            )
            yield f"data: {json.dumps({'stage': 'rag_context', 'data': rag_context.model_dump()})}\n\n"

            # ── Stage 6: Answer ─────────────────────────────────────────────────
            t4 = time.time()
            ans = state.rag_pipeline.answer_extractive(q)
            latencies["answer"] = round((time.time() - t4) * 1000, 2)
            answer = AnswerInfo(answer_text=ans.answer_text, citations=ans.citations,
                                mode=ans.mode, latency_ms=ans.latency_ms)
            yield f"data: {json.dumps({'stage': 'answer', 'data': answer.model_dump()})}\n\n"

            yield f"data: {json.dumps({'stage': 'done', 'latencies_ms': latencies})}\n\n"

        except Exception as exc:
            yield f"data: {json.dumps({'stage': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
