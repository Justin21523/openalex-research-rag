"""OpenAlex Research Intelligence — Streamlit main entry point."""

import importlib

import streamlit as st

st.set_page_config(
    page_title="OpenAlex Research Intelligence",
    page_icon="🔬",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Global CSS ──────────────────────────────────────────────────────────────
st.markdown(
    """
    <style>
    /* Sidebar */
    [data-testid="stSidebar"] {
        background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 100%);
    }
    [data-testid="stSidebar"] * { color: #e2e8f0 !important; }
    [data-testid="stSidebar"] .stRadio label { font-size: 0.95rem; }

    /* Main header */
    .rai-header {
        background: linear-gradient(135deg, #1e3a5f 0%, #0f4c75 50%, #1b6ca8 100%);
        padding: 1.5rem 2rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .rai-header h1 { color: #ffffff; margin: 0; font-size: 1.8rem; }
    .rai-header p  { color: #a0c4e8; margin: 0.3rem 0 0; font-size: 0.95rem; }

    /* Cards */
    .work-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-left: 4px solid #1b6ca8;
        border-radius: 8px;
        padding: 1rem 1.2rem;
        margin-bottom: 0.8rem;
        transition: box-shadow 0.2s;
    }
    .work-card:hover { box-shadow: 0 2px 12px rgba(27,108,168,0.15); }
    .work-card h4 { color: #1e3a5f; margin: 0 0 0.3rem; font-size: 1rem; }
    .work-card .meta { color: #64748b; font-size: 0.82rem; margin-bottom: 0.4rem; }
    .work-card .abstract { color: #374151; font-size: 0.88rem; }

    /* Badges */
    .badge {
        display: inline-block;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-right: 0.3rem;
    }
    .badge-blue   { background: #dbeafe; color: #1d4ed8; }
    .badge-green  { background: #dcfce7; color: #166534; }
    .badge-orange { background: #ffedd5; color: #9a3412; }
    .badge-purple { background: #f3e8ff; color: #6b21a8; }

    /* Score bars */
    .score-row { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.4rem; }
    .score-label { color: #94a3b8; font-size: 0.75rem; width: 50px; }
    .score-bar-bg { flex: 1; background: #e2e8f0; border-radius: 4px; height: 6px; }
    .score-bar-fill { background: #1b6ca8; border-radius: 4px; height: 6px; }

    /* Citation chip */
    .citation-chip {
        display: inline-block;
        background: #1e3a5f;
        color: #93c5fd;
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
        font-size: 0.78rem;
        font-family: monospace;
        margin: 0.1rem;
    }

    /* Answer box */
    .answer-box {
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 10px;
        padding: 1.2rem 1.5rem;
        font-size: 0.97rem;
        line-height: 1.7;
        color: #0c4a6e;
    }

    /* Metric tile */
    .metric-tile {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 1rem;
        text-align: center;
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .metric-tile .value { font-size: 1.8rem; font-weight: 700; color: #1b6ca8; }
    .metric-tile .label { font-size: 0.8rem; color: #64748b; }

    /* Streamlit button overrides */
    .stButton > button {
        background: #1b6ca8;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.4rem 1.2rem;
        font-weight: 500;
    }
    .stButton > button:hover { background: #1557a0; }

    /* Hide Streamlit branding */
    footer { visibility: hidden; }
    </style>
    """,
    unsafe_allow_html=True,
)

_PAGES = {
    "🔍 Paper Search": "src.app.pages.01_paper_search",
    "👤 Author Dashboard": "src.app.pages.02_author_dashboard",
    "🕸️ Citation Graph": "src.app.pages.03_citation_graph",
    "📈 Topic Trends": "src.app.pages.04_topic_trends",
    "🤖 RAG Q&A": "src.app.pages.05_rag_qa",
}

# ── Sidebar ──────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🔬 Research Intelligence")
    st.markdown("---")
    selection = st.radio("Navigate", list(_PAGES.keys()), label_visibility="collapsed")
    st.markdown("---")
    st.markdown(
        "<small style='color:#94a3b8'>Data: OpenAlex (CC0)<br>"
        "Model: all-MiniLM-L6-v2<br>"
        "Search: BM25 + Dense + RRF</small>",
        unsafe_allow_html=True,
    )

# ── Load and render page ──────────────────────────────────────────────────────
module_name = _PAGES[selection]
mod = importlib.import_module(module_name)
mod.render()
