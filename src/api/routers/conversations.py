"""Multi-turn RAG conversation endpoints."""

from __future__ import annotations

import json
import uuid
from collections.abc import Iterator
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.api.dependencies import get_app_state, get_conn
from src.api.state import AppState
from src.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/conversations", tags=["conversations"])


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class SessionOut(BaseModel):
    session_id: str
    title: str | None = None
    created_at: str
    last_active_at: str
    message_count: int = 0


class MessageOut(BaseModel):
    message_id: str
    session_id: str
    role: str
    content: str
    citations: list[str] = []
    evidence_works: list[dict] = []
    hop_works: list[dict] = []
    mode: str | None = None
    latency_ms: float | None = None
    created_at: str


class ConversationDetail(BaseModel):
    session: SessionOut
    messages: list[MessageOut]


class AskRequest(BaseModel):
    query: str
    top_k: int = 5
    use_extractive_fallback: bool = False
    multi_hop: bool = False


# ── Helpers ────────────────────────────────────────────────────────────────────

def _session_row(conn, session_id: str) -> tuple | None:
    return conn.execute(
        "SELECT session_id, title, created_at::VARCHAR, last_active_at::VARCHAR "
        "FROM conversation_sessions WHERE session_id=?",
        [session_id],
    ).fetchone()


def _to_session_out(row: tuple, conn, session_id: str) -> SessionOut:
    msg_count = conn.execute(
        "SELECT COUNT(*) FROM conversation_messages WHERE session_id=?", [session_id]
    ).fetchone()[0]
    return SessionOut(
        session_id=row[0], title=row[1],
        created_at=row[2] or "", last_active_at=row[3] or "",
        message_count=msg_count,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("", response_model=SessionOut, status_code=201)
def create_session(title: str = Query("New Conversation"), conn=Depends(get_conn)) -> SessionOut:
    sess_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO conversation_sessions (session_id, title, created_at, last_active_at) VALUES (?,?,?,?)",
        [sess_id, title, now, now],
    )
    conn.commit()
    return SessionOut(session_id=sess_id, title=title, created_at=now, last_active_at=now)


@router.get("", response_model=list[SessionOut])
def list_sessions(limit: int = Query(20, ge=1, le=100), conn=Depends(get_conn)) -> list[SessionOut]:
    rows = conn.execute(
        "SELECT session_id, title, created_at::VARCHAR, last_active_at::VARCHAR "
        "FROM conversation_sessions ORDER BY last_active_at DESC LIMIT ?",
        [limit],
    ).fetchall()
    return [_to_session_out(r, conn, r[0]) for r in rows]


@router.get("/{session_id}", response_model=ConversationDetail)
def get_session(session_id: str, conn=Depends(get_conn)) -> ConversationDetail:
    row = _session_row(conn, session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    msg_rows = conn.execute(
        """SELECT message_id, session_id, role, content,
                  citations_json, evidence_works_json, hop_works_json,
                  mode, latency_ms, created_at::VARCHAR
           FROM conversation_messages WHERE session_id=? ORDER BY created_at""",
        [session_id],
    ).fetchall()

    messages = [
        MessageOut(
            message_id=r[0], session_id=r[1], role=r[2], content=r[3] or "",
            citations=json.loads(r[4] or "[]"),
            evidence_works=json.loads(r[5] or "[]"),
            hop_works=json.loads(r[6] or "[]"),
            mode=r[7], latency_ms=r[8],
            created_at=r[9] or "",
        )
        for r in msg_rows
    ]
    return ConversationDetail(session=_to_session_out(row, conn, session_id), messages=messages)


@router.post("/{session_id}/ask")
def ask(
    session_id: str,
    body: AskRequest,
    conn=Depends(get_conn),
    state: AppState = Depends(get_app_state),
) -> StreamingResponse:
    """Add a user message and stream the RAG assistant reply."""
    row = _session_row(conn, session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    rag = state.rag_pipeline
    if rag is None:
        raise HTTPException(status_code=503, detail="RAG pipeline not initialised.")

    # 1. Persist user message
    user_msg_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO conversation_messages (message_id, session_id, role, content, created_at) VALUES (?,?,?,?,?)",
        [user_msg_id, session_id, "user", body.query, now],
    )
    conn.commit()

    # 2. Choose RAG stream
    if body.use_extractive_fallback or not rag.is_llm_available():
        source_gen: Iterator[str] = rag._stream_extractive(body.query)
    else:
        source_gen = rag.answer_stream(body.query)

    # 3. Wrapping generator: yield SSE to client, collect for persistence
    asst_msg_id = str(uuid.uuid4())

    def _gen() -> Iterator[str]:
        tokens: list[str] = []
        done_event: dict = {}

        for sse_line in source_gen:
            yield sse_line
            if sse_line.startswith("data: "):
                try:
                    event = json.loads(sse_line[6:])
                    if event.get("type") == "token":
                        tokens.append(event.get("content", ""))
                    elif event.get("type") == "done":
                        done_event = event
                except Exception:
                    pass

        # After stream, persist assistant message
        answer_text = "".join(tokens) or done_event.get("answer_text", "")
        asst_now = datetime.utcnow().isoformat()
        try:
            conn.execute(
                """INSERT INTO conversation_messages
                   (message_id, session_id, role, content, citations_json,
                    evidence_works_json, hop_works_json, mode, latency_ms, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                [
                    asst_msg_id, session_id, "assistant", answer_text,
                    json.dumps(done_event.get("citations", [])),
                    json.dumps(done_event.get("evidence_works", [])),
                    json.dumps(done_event.get("hop_works", [])),
                    done_event.get("mode"),
                    done_event.get("latency_ms"),
                    asst_now,
                ],
            )
            conn.execute(
                "UPDATE conversation_sessions SET last_active_at=? WHERE session_id=?",
                [asst_now, session_id],
            )
            conn.commit()
        except Exception as e:
            logger.warning("Failed to persist assistant message: %s", e)

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/{session_id}", status_code=200)
def delete_session(session_id: str, conn=Depends(get_conn)) -> dict:
    conn.execute("DELETE FROM conversation_messages WHERE session_id=?", [session_id])
    result = conn.execute("DELETE FROM conversation_sessions WHERE session_id=?", [session_id])
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    conn.commit()
    return {"deleted": session_id}
