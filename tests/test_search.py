"""Tests for BM25 index, RRF, hybrid search."""

import pytest

from src.features.bm25_index import BM25Index
from src.retrieval.hybrid_search import HybridSearch, reciprocal_rank_fusion


# ── BM25 ─────────────────────────────────────────────────────────────────────

def test_bm25_returns_k_results(bm25_index):
    results = bm25_index.search("transformer attention", k=3)
    assert len(results) == 3


def test_bm25_relevant_work_ranks_high(bm25_index):
    results = bm25_index.search("transformer attention mechanism", k=5)
    ids = [r["work_id"] for r in results]
    assert "W0000000001" in ids[:3]


def test_bm25_scores_are_non_negative(bm25_index):
    results = bm25_index.search("deep learning neural network", k=5)
    for r in results:
        assert r["bm25_score"] >= 0


def test_bm25_ranks_are_sequential(bm25_index):
    results = bm25_index.search("machine learning", k=5)
    ranks = [r["rank"] for r in results]
    assert ranks == list(range(1, len(ranks) + 1))


def test_bm25_empty_corpus_raises(in_memory_conn):
    idx = BM25Index()
    with pytest.raises(RuntimeError, match="No works found"):
        idx.build(in_memory_conn)


def test_bm25_missing_index_raises(tmp_path):
    idx = BM25Index(tmp_path / "nonexistent.joblib")
    with pytest.raises(FileNotFoundError):
        idx.load()


# ── RRF ──────────────────────────────────────────────────────────────────────

def test_rrf_fusion_correct_formula():
    lists = [
        [("A", 1), ("B", 2)],
        [("B", 1), ("C", 2)],
    ]
    fused = reciprocal_rank_fusion(lists, rrf_k=60)
    fused_dict = dict(fused)
    # B appears in both lists (rank 2 and 1)
    assert fused_dict["B"] > fused_dict["A"]
    assert fused_dict["B"] > fused_dict["C"]


def test_rrf_handles_disjoint_lists():
    lists = [
        [("A", 1)],
        [("B", 1)],
    ]
    fused = dict(reciprocal_rank_fusion(lists, rrf_k=60))
    assert "A" in fused and "B" in fused
    assert abs(fused["A"] - fused["B"]) < 1e-10


def test_rrf_returns_sorted_descending():
    lists = [
        [("A", 1), ("B", 2), ("C", 3)],
        [("A", 1), ("C", 2)],
    ]
    fused = reciprocal_rank_fusion(lists)
    scores = [s for _, s in fused]
    assert scores == sorted(scores, reverse=True)


# ── HybridSearch ──────────────────────────────────────────────────────────────

def test_hybrid_search_bm25_mode(bm25_index, mock_vector_store, mock_embedder):
    search = HybridSearch(bm25_index, mock_vector_store, mock_embedder)
    results = search.search("transformer", k=3, mode="bm25")
    assert len(results) <= 3
    assert all(r.get("bm25_score") is not None for r in results)


def test_hybrid_search_vector_mode(bm25_index, mock_vector_store, mock_embedder):
    search = HybridSearch(bm25_index, mock_vector_store, mock_embedder)
    results = search.search("transformer", k=3, mode="vector")
    assert len(results) <= 3
    mock_embedder.encode_query.assert_called_once()


def test_hybrid_search_returns_rrf_scores(bm25_index, mock_vector_store, mock_embedder):
    search = HybridSearch(bm25_index, mock_vector_store, mock_embedder)
    results = search.search("transformer attention", k=3, mode="hybrid")
    assert len(results) > 0
    for r in results:
        assert "rrf_score" in r
        assert r["rank"] >= 1


def test_hybrid_search_rank_ordering(bm25_index, mock_vector_store, mock_embedder):
    search = HybridSearch(bm25_index, mock_vector_store, mock_embedder)
    results = search.search("language model", k=5, mode="hybrid")
    ranks = [r["rank"] for r in results]
    assert ranks == sorted(ranks)
