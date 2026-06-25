"""Topic trend analysis page."""

import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from src.app._api import api_get


def _concept_network(nodes: list, edges: list) -> go.Figure:
    import math

    n = len(nodes)
    pos = {}
    for i, node in enumerate(nodes):
        angle = 2 * math.pi * i / max(n, 1)
        r = 1.0
        pos[node["id"]] = (r * math.cos(angle), r * math.sin(angle))

    max_count = max((node.get("count", 1) for node in nodes), default=1)

    edge_x, edge_y = [], []
    for edge in edges:
        x0, y0 = pos.get(edge["source"], (0, 0))
        x1, y1 = pos.get(edge["target"], (0, 0))
        edge_x += [x0, x1, None]
        edge_y += [y0, y1, None]

    nx = [pos[n["id"]][0] for n in nodes]
    ny = [pos[n["id"]][1] for n in nodes]
    nsizes = [8 + 22 * (n.get("count", 1) / max_count) for n in nodes]
    ntext = [n["name"] for n in nodes]
    nhover = [f"{n['name']}<br>{n['count']} works" for n in nodes]

    fig = go.Figure(
        data=[
            go.Scatter(x=edge_x, y=edge_y, mode="lines",
                       line=dict(color="#cbd5e1", width=1), hoverinfo="none"),
            go.Scatter(
                x=nx, y=ny, mode="markers+text",
                marker=dict(size=nsizes, color="#1b6ca8",
                            opacity=0.8, line=dict(width=1, color="white")),
                text=ntext, textposition="top center",
                hovertext=nhover, hoverinfo="text",
                textfont=dict(size=8, color="#1e3a5f"),
            ),
        ],
        layout=go.Layout(
            showlegend=False,
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            height=450,
            margin=dict(l=10, r=10, t=10, b=10),
            paper_bgcolor="white",
        ),
    )
    return fig


def render() -> None:
    st.markdown(
        """
        <div class="rai-header">
          <h1>📈 Topic Trends</h1>
          <p>Publication trends and concept co-occurrence across years</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # ── Controls ─────────────────────────────────────────────────────────────
    with st.spinner("Loading concepts …"):
        concepts_data = api_get("/topics/concepts", {"limit": 50})

    concept_names = ["(All topics)"] + [c["concept_name"] for c in (concepts_data or [])]
    col1, col2, col3 = st.columns(3)
    concept = col1.selectbox("Concept filter", concept_names)
    year_from = col2.slider("Year from", 2010, 2024, 2015)
    year_to = col3.slider("Year to", 2010, 2025, 2024)

    chosen_concept = None if concept == "(All topics)" else concept

    with st.spinner("Loading trends …"):
        params: dict = {"year_from": year_from, "year_to": year_to}
        if chosen_concept:
            params["concept"] = chosen_concept
        trends_data = api_get("/topics/trends", params)

    if not trends_data:
        return

    tab1, tab2 = st.tabs(["Publication Trend", "Concept Co-occurrence Network"])

    with tab1:
        if trends_data:
            years = [t["year"] for t in trends_data]
            counts = [t["count"] for t in trends_data]
            avg_cites = [t["avg_cited_by_count"] for t in trends_data]

            fig = go.Figure()
            fig.add_trace(go.Bar(
                x=years, y=counts, name="Publications",
                marker_color="#1b6ca8", opacity=0.8,
                yaxis="y",
            ))
            fig.add_trace(go.Scatter(
                x=years, y=avg_cites, name="Avg Citations",
                mode="lines+markers", line=dict(color="#f59e0b", width=2),
                marker=dict(size=6), yaxis="y2",
            ))
            fig.update_layout(
                title=f"Publications per Year{' — ' + chosen_concept if chosen_concept else ''}",
                yaxis=dict(title="Number of Works", side="left"),
                yaxis2=dict(title="Avg Citations", overlaying="y", side="right"),
                legend=dict(x=0.01, y=0.99),
                height=400,
                hovermode="x unified",
                margin=dict(t=40, b=20),
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No data for the selected period / concept.")

    with tab2:
        with st.spinner("Loading concept co-occurrence …"):
            graph_data = api_get("/graph/concept-cooccurrence", {"top_n": 25, "min_weight": 2})

        if graph_data and graph_data.get("nodes"):
            fig2 = _concept_network(graph_data["nodes"], graph_data["edges"])
            st.plotly_chart(fig2, use_container_width=True)

            col_n, col_e = st.columns(2)
            col_n.metric("Concepts", len(graph_data["nodes"]))
            col_e.metric("Co-occurrence Edges", len(graph_data["edges"]))
        else:
            st.info("No concept co-occurrence data available.")

    # ── Top concepts table ────────────────────────────────────────────────────
    st.markdown("---")
    st.subheader("Top Research Concepts")
    if concepts_data:
        import pandas as pd
        df = pd.DataFrame(concepts_data[:20])
        df.columns = ["Concept ID", "Concept Name", "Work Count"]
        st.dataframe(df[["Concept Name", "Work Count"]], use_container_width=True, hide_index=True)
