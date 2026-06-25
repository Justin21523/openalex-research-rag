"""Author / Institution dashboard page."""

import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from src.app._api import api_get


def render() -> None:
    st.markdown(
        """
        <div class="rai-header">
          <h1>👤 Author & Institution Dashboard</h1>
          <p>Explore author productivity and institutional analytics</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    tab1, tab2 = st.tabs(["Author Search", "Institution Search"])

    # ── Author Search ─────────────────────────────────────────────────────────
    with tab1:
        col_q, col_btn = st.columns([5, 1])
        with col_q:
            author_query = st.text_input(
                "Author name",
                placeholder="e.g. Yoshua Bengio",
                key="author_q",
                label_visibility="collapsed",
            )
        with col_btn:
            author_search = st.button("Search Authors", key="author_btn")

        if author_query:
            with st.spinner("Searching authors …"):
                results = api_get("/authors/search", {"q": author_query, "limit": 10})

            if not results:
                st.info("No authors found. Try a different name.")
                return

            # Select author
            options = {
                f"{a['display_name']} (works: {a['works_count']}, cites: {a['cited_by_count']})": a["author_id"]
                for a in results
            }
            chosen_label = st.selectbox("Select author", list(options.keys()))
            author_id = options[chosen_label]

            with st.spinner("Loading author profile …"):
                profile = api_get(f"/authors/{author_id}")

            if not profile:
                return

            # Profile card
            col1, col2, col3 = st.columns(3)
            col1.markdown(
                f"""<div class="metric-tile">
                  <div class="value">{profile.get('works_count', 0):,}</div>
                  <div class="label">Publications</div>
                </div>""",
                unsafe_allow_html=True,
            )
            col2.markdown(
                f"""<div class="metric-tile">
                  <div class="value">{profile.get('cited_by_count', 0):,}</div>
                  <div class="label">Total Citations</div>
                </div>""",
                unsafe_allow_html=True,
            )
            col3.markdown(
                f"""<div class="metric-tile">
                  <div class="value">{profile.get('institution_name') or '—'}</div>
                  <div class="label">Institution</div>
                </div>""",
                unsafe_allow_html=True,
            )

            st.markdown("---")
            recent = profile.get("recent_works", [])
            if recent:
                st.subheader("Recent Works (in sample corpus)")
                years = [w.get("publication_year") for w in recent if w.get("publication_year")]
                year_counts: dict[int, int] = {}
                for y in years:
                    year_counts[y] = year_counts.get(y, 0) + 1

                if year_counts:
                    fig = px.bar(
                        x=list(year_counts.keys()),
                        y=list(year_counts.values()),
                        labels={"x": "Year", "y": "Publications"},
                        title="Publications by Year",
                        color_discrete_sequence=["#1b6ca8"],
                    )
                    fig.update_layout(showlegend=False, height=300, margin=dict(t=40, b=20))
                    st.plotly_chart(fig, use_container_width=True)

                for w in recent:
                    st.markdown(
                        f"- **{w.get('title', 'Untitled')}** "
                        f"({w.get('publication_year', '?')}) — "
                        f"📚 {w.get('cited_by_count', 0):,} cites"
                    )

    # ── Institution Search ────────────────────────────────────────────────────
    with tab2:
        col_qi, col_btni = st.columns([5, 1])
        with col_qi:
            inst_query = st.text_input(
                "Institution name",
                placeholder="e.g. MIT, Stanford, Tsinghua",
                key="inst_q",
                label_visibility="collapsed",
            )
        with col_btni:
            st.button("Search", key="inst_btn")

        if inst_query:
            with st.spinner("Searching institutions …"):
                inst_results = api_get("/institutions/search", {"q": inst_query, "limit": 10})

            if not inst_results:
                st.info("No institutions found.")
                return

            for inst in inst_results:
                st.markdown(
                    f"""
                    <div class="work-card">
                      <h4>{inst.get('display_name', 'Unknown')}</h4>
                      <div class="meta">
                        <span class="badge badge-blue">{inst.get('country_code', '?')}</span>
                        <span class="badge badge-purple">{inst.get('type', '?')}</span>
                        <span class="badge badge-green">📚 {inst.get('cited_by_count', 0):,} citations</span>
                      </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
