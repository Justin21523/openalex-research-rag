# OpenAlex Research Intelligence (RAG)

> A full-stack **scholarly research intelligence platform** over **38,152 OpenAlex papers** — hybrid retrieval (BM25 + dense vectors with Reciprocal Rank Fusion), **citation-grounded RAG**, rich bibliometric analytics, an animated **"Data Story" pipeline journey**, a built-in **guided tour**, and a complete **中文 / English** interface.

中文簡介：以 OpenAlex 學術論文為語料的研究智能平台 — 混合檢索（BM25 + 向量 + RRF）、引用接地的 RAG 問答、主題/期刊/作者/引用網路分析、可視化的「資料旅程」、自動導覽小幫手，以及完整中英文介面。

---

## 🎬 Demo video

<video src="https://github.com/Justin21523/openalex-research-rag/raw/main/docs/demo.mp4" controls width="100%"></video>

▶️ **[Watch the full 2-minute walkthrough (docs/demo.mp4)](docs/demo.mp4)** — every feature, captured end-to-end with Playwright.

---

## ✨ Highlights

| | |
|---|---|
| **Hybrid search** | BM25 (sparse keyword) + `all-MiniLM-L6-v2` dense vectors, fused with **RRF**; live facets (year / journal / type / language / citations). |
| **Citation-grounded RAG** | Every claim carries a clickable `[Wxxxx]` citation back to the source paper; streamed answers via SSE; question builder + presets. |
| **Data Story** | Upload your data (or use the sample) and watch one query travel through **7 pipeline stages** — each animated, with a "what / effect / why" explainer and a journey summary. |
| **Analytics** | Topic trends (4 views: trend, **co-occurrence network**, heatmap, UMAP cluster), journal rankings, research velocity, citation graph, author & institution explorers, search-log observability. |
| **Guided tour** | App-like floating helper that **auto-starts**, spotlights each feature across pages, types out explanations, and plays themed particles. |
| **i18n** | Default **繁體中文**, one-click **English** toggle; technical terms kept in English. |

---

## 🖼️ Screenshots

### Guided tour (auto-triggered) + spotlight
| Welcome | Spotlight on a feature |
|---|---|
| ![tour welcome](docs/screenshots/01-tour-welcome.png) | ![tour spotlight](docs/screenshots/06-tour-step5.png) |

### Interview demo guide
| Demo guide | Data flow |
|---|---|
| ![demo guide](docs/screenshots/12-demo-guide.png) | ![data story journey](docs/screenshots/27-data-story-journey.png) |

### Dashboard · Hybrid search · RAG Q&A
| Dashboard | Search + facets | RAG with citations |
|---|---|---|
| ![dashboard](docs/screenshots/14-dashboard.png) | ![search](docs/screenshots/16-search-results.png) | ![rag](docs/screenshots/21-rag-answer.png) |

### Data Story — pipeline journey
| Source → query | Stage journey + explainer |
|---|---|
| ![data story source](docs/screenshots/26-data-story-source.png) | ![data story journey](docs/screenshots/27-data-story-journey.png) |

### Pipeline Tour & analytics
| Pipeline trace | Topic trends | Concept network |
|---|---|---|
| ![pipeline](docs/screenshots/22-pipeline.png) | ![topics](docs/screenshots/30-topics-trends.png) | ![network](docs/screenshots/31-topics-network.png) |

| Paper cluster (UMAP) | Journal analysis | Research velocity |
|---|---|---|
| ![cluster](docs/screenshots/33-topics-cluster.png) | ![journals](docs/screenshots/34-journal-analysis.png) | ![velocity](docs/screenshots/37-research-velocity.png) |

| Citation graph | Work detail | English UI |
|---|---|---|
| ![citation](docs/screenshots/43-citation-graph.png) | ![work](docs/screenshots/56-work-detail.png) | ![en](docs/screenshots/59-i18n-english-dashboard.png) |

> Full gallery: [`docs/screenshots/`](docs/screenshots/) (59 captures, long pages segmented).

---

## 🏗️ Architecture

```
        ┌───────────────── Browser (React + Vite + Tailwind) ─────────────────┐
        │  Guided tour · i18n (zh/en) · Recharts · framer-motion              │
        │  runtime config.js → API URL (no rebuild needed to repoint)         │
        └───────────────────────────────┬─────────────────────────────────────┘
                                         │ REST + SSE
        ┌───────────────────────────────▼─────────────────────────────────────┐
        │                     FastAPI backend (Python)                         │
        │  /search /rag /topics /graph /authors /institutions /analytics …     │
        │  DuckDB (works, citations…)  ·  BM25 (rank_bm25)  ·  ChromaDB (384-d) │
        │            RAG: retrieve → RRF fuse → context → LLM                   │
        └───────────────────────────────┬─────────────────────────────────────┘
                                         │ OpenAI-compatible /v1/chat/completions
                                 ┌───────▼────────┐
                                 │ llama.cpp (LLM) │
                                 └────────────────┘
```

**The pipeline (also the "Data Story"):** raw OpenAlex JSON → text cleaning / tokenize → **BM25** → **vector embedding** → **RRF fusion** → RAG context assembly → **citation-grounded answer**.

---

## 🚀 Quick start

```bash
# 1. Backend (Python) — serves on :8020
uvicorn src.api.main:app --host 0.0.0.0 --port 8020
#   needs data/openalex.duckdb, data/chroma/, data/bm25_index.joblib
#   (build them with: python src/features/build_index.py)
#   optional LLM: run llama.cpp on :8080 (OpenAI-compatible).
#   Without it, RAG falls back to extractive mode.

# 2. Frontend (React) — dev server on :5176
cd frontend && npm install && npm run dev

# 3. (demo data) pre-warm caches so heavy charts load instantly
python scripts/warmup_demo.py --base-url http://localhost:8020
```

Open http://localhost:5176 → the guided tour starts automatically.

---

## 🧱 Tech stack

- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, framer-motion, react-markdown, react-router.
- **Backend:** FastAPI, DuckDB, ChromaDB, `rank_bm25`, `sentence-transformers` (`all-MiniLM-L6-v2`), pydantic-settings, httpx (SSE streaming).
- **LLM:** llama.cpp (OpenAI-compatible), with extractive fallback.
- **Data:** OpenAlex — 38,152 works across 8+ research topics.
- **Tooling:** Playwright (E2E capture), ffmpeg.

## 📂 Repo layout

```
src/            FastAPI app, ingestion, features (BM25/embeddings), retrieval, RAG pipeline
frontend/       React app (pages, components, i18n, tour)
scripts/        warmup, e2e_capture (Playwright), deploy/tunnel helpers
docs/           screenshots + demo.mp4
DEPLOY.md       remote deployment + reverse-SSH-to-local-llama.cpp guide
```

## 🌐 Deployment

See **[DEPLOY.md](DEPLOY.md)**. The frontend's API URL is runtime-configurable (`public/config.js`) so the built bundle can point at any backend without rebuilding; the deployed backend reaches a **local** `llama.cpp` via a reverse SSH tunnel.

---

*Portfolio project — backend, retrieval, RAG, analytics, the guided tour, full i18n, and this Playwright capture pipeline were designed and implemented end-to-end.*
