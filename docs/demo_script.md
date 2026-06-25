# Demo Script

## Setup (5 minutes before demo)

```bash
# Terminal 1 — API
make api

# Terminal 2 — Streamlit
make app
```

Open browser: http://localhost:8501

---

## Demo Flow (10 minutes)

### 1. Paper Search (2 min)

Navigate to **Paper Search**.

- Query: `transformer attention mechanism deep learning`
- Mode: `hybrid`
- Show score breakdown (BM25 + vector + RRF scores)
- Change mode to `bm25` — show different ranking, faster latency
- Year filter: 2019-2022 — show filtering

**Talking points**: RRF fuses two independent signals. BM25 is precise on keywords, vector is semantic. Neither alone is as good as the fusion.

### 2. Citation Graph (2 min)

Navigate to **Citation Graph**.

- Search: `BERT language model`
- Select the Sentence-BERT paper
- Show the network graph — blue = cited by, green = cites
- Direction: switch between in/out/both

**Talking points**: Citation edges come from OpenAlex's `referenced_works` field, expanded into a DuckDB `citations` table during ETL.

### 3. Topic Trends (2 min)

Navigate to **Topic Trends**.

- Select concept: `Machine learning`
- Year range: 2017-2024
- Show publication trend line chart (count + avg citations)
- Switch to Concept Co-occurrence tab — show network of related research areas

**Talking points**: Concepts are assigned by OpenAlex's ML classifier. Co-occurrence edges reveal how research areas relate.

### 4. Author Dashboard (1 min)

Navigate to **Author Dashboard**.

- Search: `Vaswani` or any author name in the corpus
- Show profile card (works count, citations, institution)
- Publications by year bar chart

### 5. RAG Q&A (3 min)

Navigate to **RAG Q&A**.

- Sample question: "How does self-attention work in transformer models?"
- Extractive mode: show answer with `[Wxxxxxxx]` citations, evidence cards
- Point out grounding check (green ✅)
- Discuss: LLM mode requires LLM_VENDOR_API_KEY, produces natural prose but same citation discipline

**Talking points**: The system prompt enforces every factual claim must include a citation. No hallucination is possible without violating the citation contract. The grounding validator checks that cited IDs appear in the retrieved set.

---

## API Demo (via /docs)

Open http://localhost:8000/docs

- `GET /health` — show works_count=195, chromadb_count=195, bm25_ready=true
- `GET /search?q=transformer&mode=hybrid&k=5`
- `POST /rag/answer` with `{"query": "What is BERT?", "top_k": 3, "use_extractive_fallback": true}`
