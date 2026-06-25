"""POST /rag/answer — citation-grounded RAG endpoint."""

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from src.api.dependencies import get_app_state, get_conn
from src.api.schemas.responses import RAGRequest, RAGResponse, WorkHit
from src.api.state import AppState
from src.retrieval.duckdb_store import get_work_by_id, get_works_by_ids

router = APIRouter(prefix="/rag", tags=["rag"])


class LitReviewRequest(BaseModel):
    topic: str
    num_papers: int = 15
    focus: str = "review"  # "review" | "gaps"


def _work_hit(w, rank: int) -> WorkHit:
    d = isinstance(w, dict)
    return WorkHit(
        work_id=w["work_id"] if d else w.work_id,
        title=w.get("title") if d else w.title,
        abstract=((w.get("abstract") or "") if d else (w.abstract or ""))[:300],
        publication_year=w.get("publication_year") if d else w.publication_year,
        cited_by_count=w.get("cited_by_count", 0) if d else (w.cited_by_count or 0),
        doi=w.get("doi") if d else w.doi,
        journal=w.get("journal") if d else w.journal,
        rank=rank,
    )


def _build_rag_response(request: RAGRequest, result, state: AppState) -> RAGResponse:
    evidence = [_work_hit(w, i + 1) for i, w in enumerate(result.evidence_works)]
    hop_works = [_work_hit(w, i + 1) for i, w in enumerate(getattr(result, "hop_works", []) or [])]
    return RAGResponse(
        query=request.query,
        answer_text=result.answer_text,
        citations=result.citations,
        evidence_works=evidence,
        hop_works=hop_works,
        latency_ms=round(result.latency_ms, 2),
        mode=result.mode,
    )


@router.post("/answer", response_model=RAGResponse)
def rag_answer(
    request: RAGRequest,
    state: AppState = Depends(get_app_state),
) -> RAGResponse:
    rag = state.rag_pipeline
    if rag is None:
        raise HTTPException(status_code=503, detail="RAG pipeline not initialised.")

    if request.use_extractive_fallback:
        result = rag.answer_extractive(request.query)
    elif request.multi_hop:
        result = rag.answer_multihop(request.query)
    else:
        if not rag.is_llm_available():
            raise HTTPException(
                status_code=503,
                detail=(
                    "llama.cpp server unavailable. "
                    "Start with: llama-server -m model.gguf --port 8080 "
                    "or set use_extractive_fallback=true."
                ),
            )
        result = rag.answer(request.query)

    return _build_rag_response(request, result, state)


@router.post("/answer/stream")
def rag_answer_stream(
    request: RAGRequest,
    state: AppState = Depends(get_app_state),
):
    """Stream citation-grounded RAG answer as Server-Sent Events.

    Events:
        {"type": "token", "content": "..."}   — partial answer token
        {"type": "done", "answer_text": "...", "citations": [...],
         "evidence_works": [...], "latency_ms": ..., "mode": "..."}
    """
    rag = state.rag_pipeline
    if rag is None:
        raise HTTPException(status_code=503, detail="RAG pipeline not initialised.")

    if request.use_extractive_fallback or not rag.is_llm_available():
        gen = rag._stream_extractive(request.query)
    else:
        gen = rag.answer_stream(request.query)

    return StreamingResponse(
        gen,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/works/{work_id}/summarize")
def summarize_work(work_id: str, conn=Depends(get_conn), state: AppState = Depends(get_app_state)):
    """Stream a 3-5 bullet-point AI summary of a single paper."""
    rag = state.rag_pipeline
    if rag is None or not rag.is_llm_available():
        raise HTTPException(status_code=503, detail="LLM not available.")
    work = get_work_by_id(conn, work_id)
    if not work:
        raise HTTPException(status_code=404, detail=f"Work '{work_id}' not found.")
    context = (
        f"Title: {work.get('title', 'N/A')}\n"
        f"Year: {work.get('publication_year', 'N/A')} | "
        f"Citations: {work.get('cited_by_count', 0)}\n"
        f"Journal: {work.get('journal', 'N/A')}\n\n"
        f"Abstract: {(work.get('abstract') or '')[:1200]}"
    )
    system = (
        "You are a research assistant. Summarize the following paper in exactly 4 bullet points:\n"
        "• Main contribution\n• Methodology / approach\n• Key findings / results\n• Significance / impact\n"
        "Be concise (1-2 sentences per bullet). Do not add extra commentary."
    )
    gen = rag.stream_with_prompt(context, system)
    return StreamingResponse(gen, media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/literature-review/stream")
def literature_review_stream(req: LitReviewRequest, state: AppState = Depends(get_app_state)):
    """Stream a structured literature review or research gap analysis."""
    rag = state.rag_pipeline
    if rag is None or not rag.is_llm_available():
        raise HTTPException(status_code=503, detail="LLM not available.")

    hits = rag._search.search(req.topic, k=min(req.num_papers, 20))
    works = get_works_by_ids(state.conn, [h["work_id"] for h in hits])
    if not works:
        raise HTTPException(status_code=404, detail="No papers found for this topic.")

    parts = []
    for w in works:
        abstract = (w.get("abstract") or "")[:500]
        parts.append(
            f"[{w['work_id']}] {w.get('title', 'N/A')} ({w.get('publication_year', '?')})\n{abstract}"
        )
    context = "\n\n---\n\n".join(parts)

    if req.focus == "gaps":
        system = (
            "You are a research analyst. Based on the following papers, identify 5 specific research gaps "
            "and open problems that have NOT been adequately addressed. For each gap:\n"
            "1. State the gap clearly\n2. Explain why it matters\n3. Suggest a direction to address it\n"
            "Ground each point in the provided papers."
        )
        user_msg = f"Research topic: {req.topic}\n\nPapers:\n{context}"
    else:
        system = (
            "You are a research analyst. Write a structured literature review with these sections:\n"
            "## Overview\n## Key Approaches\n## Main Findings\n## Limitations\n## Future Directions\n"
            "Cite papers using their Work IDs in brackets (e.g. [W2741809807]). Be concise."
        )
        user_msg = f"Topic: {req.topic}\n\nPapers:\n{context}"

    gen = rag.stream_with_prompt(user_msg, system)
    return StreamingResponse(gen, media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/topic-digest/stream")
def topic_digest_stream(
    concept: str = Query(..., description="Concept/topic name"),
    top_n: int = Query(10, ge=3, le=20),
    state: AppState = Depends(get_app_state),
):
    """Stream a digest of the most-cited recent papers on a topic."""
    rag = state.rag_pipeline
    if rag is None or not rag.is_llm_available():
        raise HTTPException(status_code=503, detail="LLM not available.")

    rows = state.conn.execute(
        """SELECT w.work_id, w.title, w.publication_year, w.cited_by_count,
                  w.abstract, w.primary_location_name
           FROM works w
           WHERE w.concepts_json ILIKE ?
             AND w.publication_year >= 2022
           ORDER BY w.cited_by_count DESC
           LIMIT ?""",
        [f"%{concept}%", top_n],
    ).fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail=f"No recent papers found for '{concept}'.")

    papers_text = "\n\n".join(
        f"[{r[0]}] {r[1]} ({r[2]}) — {r[3]} citations\n{(r[4] or '')[:300]}"
        for r in rows
    )
    system = (
        "You are a research digest writer. Given the following recent papers, write a concise "
        "weekly digest (3-5 paragraphs) covering: trending themes, notable findings, and what "
        "researchers are focusing on. Cite papers using [Work ID] format."
    )
    user_msg = f"Topic: {concept}\n\nRecent papers:\n{papers_text}"
    gen = rag.stream_with_prompt(user_msg, system)
    return StreamingResponse(gen, media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
