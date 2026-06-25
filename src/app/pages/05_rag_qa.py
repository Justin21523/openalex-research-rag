"""RAG Q&A page — citation-grounded answers."""

import os
import re

import streamlit as st

from src.app._api import api_get, api_post

_SAMPLE_QUESTIONS = [
    "What is the transformer attention mechanism and how does it work?",
    "How does BERT improve upon previous language model pretraining methods?",
    "What are the key applications of graph neural networks?",
    "How does retrieval-augmented generation differ from standard language models?",
    "What methods are used for knowledge graph embedding?",
]


def _highlight_citations(text: str) -> str:
    """Wrap [WXXXXXXX] citations in HTML spans for display."""
    return re.sub(
        r"\[W(\d+)\]",
        r'<span class="citation-chip">[W\1]</span>',
        text,
    )


def _evidence_card(w: dict, idx: int) -> None:
    title = w.get("title", "Untitled")
    year = w.get("publication_year", "?")
    cites = w.get("cited_by_count", 0)
    abstract = (w.get("abstract") or "")[:300]
    journal = w.get("journal") or ""
    work_id = w.get("work_id", "")

    st.markdown(
        f"""
        <div class="work-card">
          <h4>Evidence #{idx}: {title}</h4>
          <div class="meta">
            <span class="badge badge-blue">{year}</span>
            <span class="badge badge-green">📚 {cites:,} cites</span>
            {f'<span class="badge badge-purple">{journal[:30]}</span>' if journal else ''}
            <code style="font-size:0.75rem;color:#64748b;">{work_id}</code>
          </div>
          {f'<div class="abstract">{abstract}…</div>' if abstract else ''}
        </div>
        """,
        unsafe_allow_html=True,
    )


def render() -> None:
    st.markdown(
        """
        <div class="rai-header">
          <h1>🤖 RAG Q&A</h1>
          <p>Citation-grounded answers from the OpenAlex research corpus</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ── Mode notice ───────────────────────────────────────────────────────────
    has_key = bool(os.getenv("LLM_VENDOR_API_KEY", ""))
    if has_key:
        st.success("🟢 LLM mode active (llm_provider-haiku-4-5)")
    else:
        st.info(
            "🟡 **Extractive mode** — Set `LLM_VENDOR_API_KEY` in `.env` for LLM-generated answers. "
            "Extractive mode returns abstract snippets with citations."
        )

    # ── Sample questions ──────────────────────────────────────────────────────
    with st.expander("💡 Try a sample question"):
        for q in _SAMPLE_QUESTIONS:
            if st.button(q, key=f"sample_{hash(q)}"):
                st.session_state["rag_query"] = q

    # ── Input ─────────────────────────────────────────────────────────────────
    query = st.text_area(
        "Ask a research question",
        value=st.session_state.get("rag_query", ""),
        placeholder="e.g. How does self-attention work in transformers?",
        height=100,
        key="rag_input",
    )

    col1, col2, col3 = st.columns([2, 2, 1])
    top_k = col1.slider("Evidence papers", 3, 10, 5)
    use_extractive = col2.checkbox("Force extractive mode", value=not has_key)
    ask_clicked = col3.button("Ask", use_container_width=True)

    if not query:
        return

    if ask_clicked or st.session_state.get("rag_submitted"):
        st.session_state["rag_submitted"] = False
        with st.spinner("Retrieving papers and generating answer …"):
            result = api_post(
                "/rag/answer",
                {
                    "query": query,
                    "top_k": top_k,
                    "use_extractive_fallback": use_extractive or not has_key,
                },
            )

        if result is None:
            return

        # ── Answer ────────────────────────────────────────────────────────────
        mode_badge = (
            '<span class="badge badge-green">🤖 LLM</span>'
            if result.get("mode") == "llm"
            else '<span class="badge badge-orange">📄 Extractive</span>'
        )
        latency = result.get("latency_ms", 0)
        citations = result.get("citations", [])

        st.markdown(f"**Answer** {mode_badge} — ⚡ {latency:.0f} ms", unsafe_allow_html=True)

        highlighted = _highlight_citations(result.get("answer_text", ""))
        st.markdown(
            f'<div class="answer-box">{highlighted}</div>',
            unsafe_allow_html=True,
        )

        # ── Citations ─────────────────────────────────────────────────────────
        if citations:
            chips = "".join(f'<span class="citation-chip">[{c}]</span>' for c in citations)
            st.markdown(
                f"<div style='margin-top:0.8rem'><b>Cited works:</b> {chips}</div>",
                unsafe_allow_html=True,
            )

        # ── Evidence cards ────────────────────────────────────────────────────
        evidence = result.get("evidence_works", [])
        if evidence:
            st.markdown("---")
            st.subheader(f"📄 Evidence Papers ({len(evidence)})")
            for i, w in enumerate(evidence, 1):
                _evidence_card(w, i)

        # ── Grounding check ───────────────────────────────────────────────────
        if citations:
            evidence_ids = {w["work_id"] for w in evidence}
            grounded = any(c in evidence_ids for c in citations)
            if grounded:
                st.success("✅ Answer is grounded in retrieved evidence papers.")
            else:
                st.warning("⚠️ No direct citation overlap with retrieved evidence.")
