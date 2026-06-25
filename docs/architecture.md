# Architecture

## Component Map

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Ingestion                                                               │
│  src/ingestion/openalex_client.py  ← Live API (httpx, cursor pagination)│
│  src/ingestion/sample_loader.py    ← data/sample/*.json (committed)     │
│  src/ingestion/schema.py           ← Pydantic v2 validation             │
│  src/preprocessing/text_cleaner.py ← abstract reconstruction            │
│  src/preprocessing/normalizer.py   ← flatten → DuckDB row dicts         │
│  src/ingestion/db_writer.py        ← INSERT OR REPLACE via pandas DF    │
│  src/ingestion/pipeline.py         ← ETL orchestrator (CLI)             │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │ DuckDB: works, citations, authors, institutions
┌──────────────────────────▼───────────────────────────────────────────────┐
│  Feature / Index Build                                                   │
│  src/features/bm25_index.py     ← BM25Okapi, joblib persistence         │
│  src/features/embeddings.py     ← SentenceTransformer (lazy load)       │
│  src/retrieval/vector_store.py  ← ChromaDB PersistentClient             │
│  src/features/concept_graph.py  ← co-occurrence from concepts_json      │
│  src/features/build_index.py    ← CLI orchestrator                      │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │ BM25 joblib + ChromaDB collection
┌──────────────────────────▼───────────────────────────────────────────────┐
│  Query / Retrieval                                                       │
│  src/retrieval/hybrid_search.py  ← RRF(BM25, dense) → top-k            │
│  src/retrieval/duckdb_store.py   ← metadata hydration, citation queries │
│  src/models/rag_pipeline.py      ← context build, LLM call, grounding   │
│  src/models/reranker.py          ← optional cross-encoder               │
│  src/evaluation/                 ← metrics, test queries, runner         │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
┌────────▼─────────┐               ┌─────────▼──────────┐
│  FastAPI (8000)  │               │ Streamlit (8501)    │
│  src/api/main.py │               │ src/app/            │
│  8 routers       │               │ 5 pages             │
│  Pydantic models │               │ httpx → API         │
└──────────────────┘               └────────────────────┘
```

## Data Store Design

| Store | Purpose | Location |
|-------|---------|----------|
| DuckDB | Analytical warehouse (metadata, citations, query logs) | `data/openalex.duckdb` |
| ChromaDB | Dense vector index | `data/chroma/` |
| joblib | BM25 index serialisation | `data/bm25_index.joblib` |

## Threading Model

- DuckDB: singleton connection, threading.Lock for init
- ChromaDB PersistentClient: thread-safe for concurrent reads
- Streamlit: calls API over HTTP — never opens DuckDB directly
- FastAPI: sync endpoints, uvicorn workers share the singleton
