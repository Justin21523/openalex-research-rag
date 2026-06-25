# Model Card

## Embedding Model

| Field | Value |
|-------|-------|
| Model | sentence-transformers/all-MiniLM-L6-v2 |
| Dimensions | 384 |
| Max sequence | 256 tokens |
| Training data | 1B+ sentence pairs |
| License | Apache 2.0 |
| Use case | Symmetric semantic similarity for hybrid search |

Input: `title title abstract` (title repeated twice for BM25-like weight)
Output: L2-normalised 384-dim vector

## BM25 Index

| Field | Value |
|-------|-------|
| Library | rank-bm25 (BM25Okapi) |
| Parameters | k1=1.5 (default), b=0.75 (default) |
| Corpus | title + title + abstract tokens |
| Tokenisation | lowercase, punctuation stripped |
| Persistence | joblib |

## LLM (RAG)

| Field | Value |
|-------|-------|
| Model | llm_provider-haiku-4-5 |
| Provider | LLMVendor |
| Max tokens | 512 |
| System prompt | Citation enforcement — every claim must cite `[Wxxxxxxx]` |
| Fallback | Extractive mode (no LLM call) when API key absent |

## Reranker (optional)

| Field | Value |
|-------|-------|
| Model | cross-encoder/ms-marco-MiniLM-L-6-v2 |
| Library | sentence-transformers CrossEncoder |
| Status | Disabled by default (set `reranker.enabled: true` in configs/search_config.yaml) |

## Known Limitations
- all-MiniLM-L6-v2 was trained on general-domain text; biomedical/domain-specific queries may underperform
- BM25 is sensitive to vocabulary mismatch; hybrid mode recommended
- LLM answers are limited to the 5 retrieved papers' context; no external knowledge
