"""Paper search page."""

import streamlit as st

from src.app._api import api_get


def _work_card(w: dict, idx: int) -> None:
    year = w.get("publication_year", "?")
    cites = w.get("cited_by_count", 0)
    journal = w.get("journal") or "Unknown venue"
    abstract = (w.get("abstract") or "")[:280]
    doi = w.get("doi", "")

    bm25 = w.get("bm25_score")
    vec = w.get("vector_score")
    rrf = w.get("rrf_score")

    st.markdown(
        f"""
        <div class="work-card">
          <h4>#{idx} {w.get('title', 'Untitled')}</h4>
          <div class="meta">
            <span class="badge badge-blue">{year}</span>
            <span class="badge badge-green">📚 {cites:,} citations</span>
            <span class="badge badge-purple">📖 {journal[:40]}</span>
            {'<span class="badge badge-orange">DOI</span>' if doi else ''}
          </div>
          {'<div class="abstract">' + abstract + '…</div>' if abstract else ''}
        </div>
        """,
        unsafe_allow_html=True,
    )

    score_cols = st.columns(3)
    if bm25 is not None:
        score_cols[0].metric("BM25", f"{bm25:.3f}")
    if vec is not None:
        score_cols[1].metric("Vector", f"{vec:.3f}")
    if rrf is not None:
        score_cols[2].metric("RRF", f"{rrf:.4f}")


def render() -> None:
    st.markdown(
        """
        <div class="rai-header">
          <h1>🔍 Paper Search</h1>
          <p>Hybrid BM25 + dense vector search over 195 OpenAlex works</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ── Controls ─────────────────────────────────────────────────────────────
    col_q, col_btn = st.columns([5, 1])
    with col_q:
        query = st.text_input(
            "Search query",
            placeholder='e.g. "transformer attention mechanism" or "knowledge graph embedding"',
            label_visibility="collapsed",
        )
    with col_btn:
        search_clicked = st.button("Search", use_container_width=True)

    col1, col2, col3, col4 = st.columns(4)
    mode = col1.selectbox("Mode", ["hybrid", "bm25", "vector"], index=0)
    k = col2.slider("Results", 5, 30, 10)
    year_from = col3.number_input("Year from", 1990, 2024, 2015)
    year_to = col4.number_input("Year to", 1990, 2025, 2024)

    if not query and not search_clicked:
        st.info("Enter a query above and click Search (or press Enter).")
        return

    if query:
        with st.spinner("Searching …"):
            data = api_get(
                "/search",
                {
                    "q": query,
                    "mode": mode,
                    "k": k,
                    "year_from": year_from,
                    "year_to": year_to,
                },
            )

        if data is None:
            return

        results = data.get("results", [])
        latency = data.get("latency_ms", 0)

        st.markdown(
            f"**{len(results)} results** &nbsp;|&nbsp; "
            f"mode: `{mode}` &nbsp;|&nbsp; "
            f"⚡ {latency:.0f} ms",
            unsafe_allow_html=True,
        )

        if not results:
            st.warning("No results found. Try a different query or mode.")
            return

        for i, w in enumerate(results, 1):
            _work_card(w, i)
            work_id = w.get("work_id", "")
            with st.expander("View citations"):
                cit_data = api_get(f"/works/{work_id}/citations", {"limit": 20})
                if cit_data:
                    cited = cit_data.get("cited", [])
                    citing = cit_data.get("citing", [])
                    c1, c2 = st.columns(2)
                    c1.caption(f"Cited by {cit_data['total_citing']} works (in corpus):")
                    for c in citing[:5]:
                        c1.write(f"← {c.get('title', c['work_id'])} ({c.get('publication_year', '?')})")
                    c2.caption(f"References {cit_data['total_cited']} works (in corpus):")
                    for c in cited[:5]:
                        c2.write(f"→ {c.get('title', c['work_id'])} ({c.get('publication_year', '?')})")
