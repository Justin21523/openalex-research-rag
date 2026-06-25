"""Citation-grounded RAG pipeline — uses local llama.cpp (OpenAI-compatible)."""

import json
import re
import time
from collections.abc import Generator

import duckdb
import httpx
from pydantic import BaseModel

from src.retrieval.duckdb_store import get_works_by_ids
from src.retrieval.hybrid_search import HybridSearch
from src.utils.logging import get_logger

logger = get_logger(__name__)

_SYSTEM_PROMPT = """\
You are a research assistant with access to a curated set of scholarly papers.
Answer the user's question using ONLY the information provided in the context below.

Rules:
1. Every factual claim MUST be followed by a citation in the format [Wxxxxxxxxx] where \
Wxxxxxxxxx is the exact Work ID shown in the context (e.g. [W2741809807]).
2. If the context does not contain enough information to answer, say so clearly.
3. Do NOT invent facts, add outside knowledge, or cite sources not in the context.
4. Keep answers concise and focused (3-6 sentences).
"""


class CitationGroundedAnswer(BaseModel):
    answer_text: str
    citations: list[str]
    evidence_works: list[dict]
    latency_ms: float
    mode: str  # "llm" | "extractive" | "multi-hop"
    hop_works: list[dict] = []  # Hop-2 citation-expanded works (multi-hop only)


class RAGPipeline:
    """Retrieve → Ground → Generate with mandatory citations."""

    def __init__(
        self,
        hybrid_search: HybridSearch,
        conn: duckdb.DuckDBPyConnection,
        llama_base_url: str = "http://localhost:8080",
        llama_model: str = "local",
        llama_max_tokens: int = 512,
        llama_timeout: float = 60.0,
        top_k: int = 5,
    ) -> None:
        self._search = hybrid_search
        self._conn = conn
        self._llama_base_url = llama_base_url.rstrip("/")
        self._model_name = llama_model
        self._max_tokens = llama_max_tokens
        self._timeout = llama_timeout
        self._top_k = top_k

    def is_llm_available(self) -> bool:
        """Ping llama.cpp health endpoint — returns False if not running."""
        try:
            r = httpx.get(f"{self._llama_base_url}/health", timeout=2.0)
            return r.status_code == 200
        except Exception:
            return False

    def _build_context(self, works: list[dict]) -> str:
        parts = []
        for w in works:
            abstract = (w.get("abstract") or "")[:800]
            parts.append(
                f"[{w['work_id']}]\n"
                f"Title: {w.get('title', 'N/A')}\n"
                f"Year: {w.get('publication_year', 'N/A')} | "
                f"Citations: {w.get('cited_by_count', 0)}\n"
                f"Abstract: {abstract}"
            )
        return "\n\n".join(parts)

    def _call_llm(self, query: str, context: str) -> str:
        resp = httpx.post(
            f"{self._llama_base_url}/v1/chat/completions",
            json={
                "model": self._model_name,
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
                ],
                "max_tokens": self._max_tokens,
                "temperature": 0.1,
                "stream": False,
            },
            timeout=self._timeout,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    def _extract_citations(self, answer_text: str) -> list[str]:
        return list(dict.fromkeys(re.findall(r"\[W\d+\]", answer_text)))

    def _validate_grounding(self, cited_ids: list[str], retrieved_ids: list[str]) -> bool:
        if not cited_ids:
            return False
        return any(c in set(retrieved_ids) for c in cited_ids)

    def _strip_brackets(self, cited: list[str]) -> list[str]:
        return [c.strip("[]") for c in cited]

    def answer(self, query: str) -> CitationGroundedAnswer:
        """Full RAG: retrieve → build context → llama.cpp → extract citations."""
        t0 = time.time()

        hits = self._search.search(query, k=self._top_k)
        hit_ids = [h["work_id"] for h in hits]
        works = get_works_by_ids(self._conn, hit_ids)

        if not works:
            return CitationGroundedAnswer(
                answer_text="No relevant papers found in the knowledge base.",
                citations=[],
                evidence_works=[],
                latency_ms=(time.time() - t0) * 1000,
                mode="extractive",
            )

        context = self._build_context(works)

        try:
            answer_text = self._call_llm(query, context)
            mode = "llm"
        except Exception as exc:
            logger.warning("llama.cpp unavailable (%s), falling back to extractive.", exc)
            return self._extractive(query, works, t0)

        raw_citations = self._extract_citations(answer_text)
        cited_ids = self._strip_brackets(raw_citations)
        evidence_works = get_works_by_ids(self._conn, cited_ids) if cited_ids else works[:2]

        return CitationGroundedAnswer(
            answer_text=answer_text,
            citations=cited_ids,
            evidence_works=evidence_works,
            latency_ms=(time.time() - t0) * 1000,
            mode=mode,
        )

    # ─── Streaming ────────────────────────────────────────────────────────────

    def answer_stream(self, query: str) -> Generator[str, None, None]:
        """Stream RAG answer as SSE events ('data: {...}\\n\\n' strings).

        Yields:
            token events:  data: {"type": "token", "content": "..."}
            done event:    data: {"type": "done", "citations": [...], "evidence_works": [...], ...}
        """
        t0 = time.time()

        hits = self._search.search(query, k=self._top_k)
        hit_ids = [h["work_id"] for h in hits]
        works = get_works_by_ids(self._conn, hit_ids)

        if not works:
            yield self._sse({"type": "done", "answer_text": "No relevant papers found.",
                             "citations": [], "evidence_works": [],
                             "latency_ms": 0.0, "mode": "extractive"})
            return

        context = self._build_context(works)
        full_text = ""

        try:
            with httpx.stream(
                "POST",
                f"{self._llama_base_url}/v1/chat/completions",
                json={
                    "model": self._model_name,
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
                    ],
                    "max_tokens": self._max_tokens,
                    "temperature": 0.1,
                    "stream": True,
                },
                timeout=self._timeout,
            ) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            full_text += delta
                            yield self._sse({"type": "token", "content": delta})
                    except (json.JSONDecodeError, KeyError, IndexError):
                        pass

            raw_citations = self._extract_citations(full_text)
            cited_ids = self._strip_brackets(raw_citations)
            evidence = get_works_by_ids(self._conn, cited_ids) if cited_ids else works[:2]
            yield self._sse({
                "type": "done",
                "answer_text": full_text,
                "citations": cited_ids,
                "evidence_works": evidence,
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "mode": "llm",
            })

        except Exception as exc:
            logger.warning("llama.cpp stream unavailable (%s), falling back to extractive.", exc)
            yield from self._stream_extractive(query, works, t0)

    def _stream_extractive(
        self, query: str, works: list[dict] | None = None, t0: float | None = None
    ) -> Generator[str, None, None]:
        """Typewriter-style streaming for extractive fallback (no LLM call)."""
        if t0 is None:
            t0 = time.time()
        if works is None:
            hits = self._search.search(query, k=self._top_k)
            works = get_works_by_ids(self._conn, [h["work_id"] for h in hits])

        result = self._extractive(query, works, t0)
        for word in result.answer_text.split():
            yield self._sse({"type": "token", "content": word + " "})
        yield self._sse({
            "type": "done",
            "answer_text": result.answer_text,
            "citations": result.citations,
            "evidence_works": result.evidence_works,
            "latency_ms": result.latency_ms,
            "mode": "extractive",
        })

    def stream_with_prompt(
        self, context: str, system_prompt: str
    ) -> Generator[str, None, None]:
        """Stream LLM response with custom context and system prompt (no retrieval)."""
        t0 = time.time()
        full_text = ""
        try:
            with httpx.stream(
                "POST",
                f"{self._llama_base_url}/v1/chat/completions",
                json={
                    "model": self._model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": context},
                    ],
                    "max_tokens": self._max_tokens,
                    "temperature": 0.2,
                    "stream": True,
                },
                timeout=self._timeout,
            ) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            full_text += delta
                            yield self._sse({"type": "token", "content": delta})
                    except (json.JSONDecodeError, KeyError, IndexError):
                        pass
            yield self._sse({
                "type": "done",
                "answer_text": full_text,
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "mode": "llm",
            })
        except Exception as exc:
            logger.warning("stream_with_prompt failed: %s", exc)
            yield self._sse({"type": "error", "message": str(exc)})

    @staticmethod
    def _sse(data: dict) -> str:
        return f"data: {json.dumps(data, default=str)}\n\n"

    # ─── Multi-hop RAG ────────────────────────────────────────────────────────

    def _expand_via_references(self, work_ids: list[str]) -> list[str]:
        """Return work IDs that are referenced by the given works and exist in our corpus."""
        if not work_ids:
            return []
        placeholders = ", ".join(["?" for _ in work_ids])
        rows = self._conn.execute(
            f"SELECT referenced_works_json FROM works WHERE work_id IN ({placeholders})",
            work_ids,
        ).fetchall()

        referenced: list[str] = []
        for (json_val,) in rows:
            refs = (json.loads(json_val) if isinstance(json_val, str) else json_val) or []
            referenced.extend(refs)

        unique_refs = list(set(referenced) - set(work_ids))
        if not unique_refs:
            return []

        batch = unique_refs[:100]
        ph2 = ", ".join(["?" for _ in batch])
        in_corpus = self._conn.execute(
            f"SELECT work_id FROM works WHERE work_id IN ({ph2})", batch
        ).fetchall()
        return [r[0] for r in in_corpus]

    def answer_multihop(self, query: str) -> CitationGroundedAnswer:
        """Multi-hop RAG: retrieve → expand via citation references → re-rank → generate."""
        t0 = time.time()

        # Tier 1 — primary retrieval
        hits = self._search.search(query, k=self._top_k)
        hit_ids = [h["work_id"] for h in hits]
        primary_works = get_works_by_ids(self._conn, hit_ids)

        # Tier 2 — expand via referenced_works (1 hop)
        expanded_ids = self._expand_via_references(hit_ids)

        # Tier 3 — re-rank expanded set via BM25 scores
        if expanded_ids:
            bm25_hits = self._search._bm25_index.search(
                query, k=min(len(expanded_ids) + 10, 50)
            )
            score_map = {h["work_id"]: h["bm25_score"] for h in bm25_hits}
            expanded_ids.sort(key=lambda wid: score_map.get(wid, 0.0), reverse=True)
            top_expanded = get_works_by_ids(self._conn, expanded_ids[: self._top_k])
        else:
            top_expanded = []

        # Combine: primary first, best expanded appended, cap context size
        all_works = primary_works + top_expanded
        all_works = all_works[: self._top_k * 2]
        context = self._build_context(all_works)

        try:
            answer_text = self._call_llm(query, context)
            mode = "multi-hop"
        except Exception as exc:
            logger.warning("LLM unavailable for multi-hop (%s), falling back.", exc)
            return self._extractive(query, all_works, t0)

        raw_citations = self._extract_citations(answer_text)
        cited_ids = self._strip_brackets(raw_citations)
        evidence = get_works_by_ids(self._conn, cited_ids) if cited_ids else all_works[:3]

        return CitationGroundedAnswer(
            answer_text=answer_text,
            citations=cited_ids,
            evidence_works=evidence,
            hop_works=top_expanded,
            latency_ms=(time.time() - t0) * 1000,
            mode=mode,
        )

    def answer_extractive(self, query: str) -> CitationGroundedAnswer:
        """Extractive fallback — no LLM, returns abstract snippets with citations."""
        t0 = time.time()
        hits = self._search.search(query, k=self._top_k)
        works = get_works_by_ids(self._conn, [h["work_id"] for h in hits])
        return self._extractive(query, works, t0)

    def _extractive(
        self, query: str, works: list[dict], t0: float
    ) -> CitationGroundedAnswer:
        parts = []
        for w in works:
            abstract = (w.get("abstract") or "")
            sentences = [s.strip() for s in abstract.split(".") if len(s.strip()) > 20]
            snippet = ". ".join(sentences[:2]) + ("." if sentences else "")
            parts.append(f"[{w['work_id']}] {w.get('title', '')}: {snippet}")

        answer_text = " ".join(parts) if parts else "No relevant papers found."
        cited_ids = [w["work_id"] for w in works]

        return CitationGroundedAnswer(
            answer_text=answer_text,
            citations=cited_ids,
            evidence_works=works,
            latency_ms=(time.time() - t0) * 1000,
            mode="extractive",
        )
