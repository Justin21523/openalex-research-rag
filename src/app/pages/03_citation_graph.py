"""Citation graph explorer page."""

import plotly.graph_objects as go
import streamlit as st

from src.app._api import api_get


def _build_network_figure(center_title: str, citing: list, cited: list) -> go.Figure:
    nodes_x, nodes_y, nodes_text, nodes_size, nodes_color = [], [], [], [], []
    edge_x, edge_y = [], []

    # Center node
    nodes_x.append(0); nodes_y.append(0)
    nodes_text.append(f"<b>{center_title[:50]}</b>")
    nodes_size.append(25); nodes_color.append("#1b6ca8")

    import math
    all_neighbors = [(w, "citing") for w in citing] + [(w, "cited") for w in cited]
    n = len(all_neighbors)

    for i, (w, direction) in enumerate(all_neighbors):
        angle = 2 * math.pi * i / max(n, 1)
        r = 1.8
        x = r * math.cos(angle)
        y = r * math.sin(angle)
        nodes_x.append(x); nodes_y.append(y)
        title = (w.get("title") or w.get("work_id") or "")[:40]
        year = w.get("publication_year", "?")
        nodes_text.append(f"{title}<br>({year})")
        nodes_size.append(14)
        nodes_color.append("#3b82f6" if direction == "citing" else "#10b981")

        edge_x += [0, x, None]
        edge_y += [0, y, None]

    edge_trace = go.Scatter(
        x=edge_x, y=edge_y, mode="lines",
        line=dict(width=1, color="#cbd5e1"),
        hoverinfo="none",
    )
    node_trace = go.Scatter(
        x=nodes_x, y=nodes_y, mode="markers+text",
        marker=dict(size=nodes_size, color=nodes_color,
                    line=dict(width=1, color="white")),
        text=nodes_text,
        textposition="top center",
        hoverinfo="text",
        textfont=dict(size=9, color="#374151"),
    )
    fig = go.Figure(
        data=[edge_trace, node_trace],
        layout=go.Layout(
            showlegend=False,
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            margin=dict(l=20, r=20, t=30, b=20),
            height=500,
            paper_bgcolor="#f8fafc",
            plot_bgcolor="#f8fafc",
            annotations=[
                dict(x=0, y=-0.12, text="🔵 Cited by  🟢 Cites",
                     showarrow=False, font=dict(size=11, color="#64748b")),
            ],
        ),
    )
    return fig


def render() -> None:
    st.markdown(
        """
        <div class="rai-header">
          <h1>🕸️ Citation Graph Explorer</h1>
          <p>Visualise citation networks for any paper in the corpus</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    col_q, col_btn = st.columns([5, 1])
    with col_q:
        query = st.text_input(
            "Search for a paper",
            placeholder='e.g. "attention is all you need"',
            label_visibility="collapsed",
        )
    with col_btn:
        st.button("Search", key="cg_search")

    direction = st.radio("Direction", ["both", "in (cited by)", "out (cites)"], horizontal=True)
    dir_map = {"both": "both", "in (cited by)": "in", "out (cites)": "out"}

    if not query:
        st.info("Search for a paper to explore its citation network.")
        return

    with st.spinner("Searching …"):
        search_data = api_get("/search", {"q": query, "k": 5, "mode": "hybrid"})

    if not search_data or not search_data.get("results"):
        st.warning("No results found.")
        return

    results = search_data["results"]
    options = {f"{r.get('title', r['work_id'])[:70]} ({r.get('publication_year','?')})": r["work_id"]
               for r in results}
    chosen = st.selectbox("Select paper", list(options.keys()))
    work_id = options[chosen]

    with st.spinner("Loading citation graph …"):
        cit_data = api_get(
            f"/works/{work_id}/citations",
            {"direction": dir_map[direction], "limit": 30},
        )

    if not cit_data:
        return

    citing = cit_data.get("citing", [])
    cited = cit_data.get("cited", [])
    total_citing = cit_data.get("total_citing", 0)
    total_cited = cit_data.get("total_cited", 0)

    col1, col2 = st.columns(2)
    col1.metric("Cited by (in corpus)", total_citing)
    col2.metric("References (in corpus)", total_cited)

    if not citing and not cited:
        st.info("No citation connections found in the sample corpus for this paper.")
        return

    fig = _build_network_figure(chosen[:50], citing, cited)
    st.plotly_chart(fig, use_container_width=True)

    with st.expander("Raw citation data"):
        col1, col2 = st.columns(2)
        col1.caption("Cited by:")
        for c in citing:
            col1.write(f"↙ {(c.get('title') or c['work_id'])[:60]}")
        col2.caption("References:")
        for c in cited:
            col2.write(f"↗ {(c.get('title') or c['work_id'])[:60]}")
