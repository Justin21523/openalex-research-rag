"""IR evaluation metrics."""

import math


def recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    """Fraction of relevant items found in top-k retrieved."""
    if not relevant:
        return 0.0
    return len(set(retrieved[:k]) & relevant) / len(relevant)


def mrr_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    """Mean Reciprocal Rank — reciprocal of first relevant item's rank."""
    for rank, item in enumerate(retrieved[:k], 1):
        if item in relevant:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    """Normalised Discounted Cumulative Gain at k (binary relevance)."""
    dcg = sum(
        1.0 / math.log2(rank + 1)
        for rank, item in enumerate(retrieved[:k], 1)
        if item in relevant
    )
    ideal_hits = min(len(relevant), k)
    idcg = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
    return dcg / idcg if idcg > 0 else 0.0


def mean_latency(latencies_ms: list[float]) -> tuple[float, float]:
    """Return (p50, p99) of a latency list."""
    if not latencies_ms:
        return 0.0, 0.0
    s = sorted(latencies_ms)
    p50_idx = int(len(s) * 0.5)
    p99_idx = min(int(len(s) * 0.99), len(s) - 1)
    return s[p50_idx], s[p99_idx]
