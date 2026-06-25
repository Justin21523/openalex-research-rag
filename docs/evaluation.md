# Evaluation

## Search Evaluation

**Method**: 9 queries with known relevant work IDs (from `src/evaluation/test_queries.py`).
Metrics computed at K=1, 5, 10.

### Results (195-work corpus)

| Mode   | R@1   | R@5   | R@10  | MRR@1 | MRR@5 | MRR@10 | nDCG@5 | nDCG@10 | P50 ms |
|--------|-------|-------|-------|-------|-------|--------|--------|---------|--------|
| BM25   | 0.315 | 0.630 | 0.759 | 0.556 | 0.633 | 0.633  | 0.539  | 0.598   | 0.2    |
| Vector | 0.093 | 0.630 | 0.759 | 0.222 | 0.467 | 0.467  | 0.429  | 0.486   | 2.6    |
| Hybrid | 0.093 | 0.704 | 0.759 | 0.222 | 0.504 | 0.504  | 0.498  | 0.522   | 2.7    |

**Key observations**:
- BM25 wins at R@1 and MRR (precise keyword matching on small corpus)
- Hybrid wins at R@5 (broader recall via vector diversity)
- All modes converge at R@10 = 0.759 (upper bound of labelled relevant docs in corpus)
- BM25 is 10-13x faster than vector/hybrid

## RAG Evaluation

| Metric | Value |
|--------|-------|
| Grounding rate | 100% (all answers contain ≥1 citation) |
| Avg citations/answer | 5.0 (extractive mode returns all retrieved work IDs) |
| Mode | Extractive (no LLM key required for evaluation) |

## Re-running Evaluation

```bash
make evaluate
# Results saved to data/evaluation_results.json
```

## Metrics Definitions

- **Recall@K**: fraction of relevant documents found in top-K results
- **MRR@K**: 1/rank of first relevant result (0 if none in top-K)
- **nDCG@K**: normalised discounted cumulative gain (binary relevance)
- **Grounding rate**: fraction of RAG answers containing ≥1 citation from retrieved evidence
