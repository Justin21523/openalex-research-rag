"""FastAPI integration tests."""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.state import AppState, set_state
from src.features.bm25_index import BM25Index
from src.retrieval.hybrid_search import HybridSearch
from src.models.rag_pipeline import RAGPipeline
from src.utils.db import get_in_memory_connection, reset_connection


@pytest.fixture
def api_client(bm25_index, mock_vector_store, mock_embedder, seeded_conn, monkeypatch):
    """Set up TestClient with injected AppState using in-memory fixtures."""
    search = HybridSearch(bm25_index, mock_vector_store, mock_embedder)
    rag = RAGPipeline(search, seeded_conn, top_k=3)

    state = AppState(
        bm25_index=bm25_index,
        vector_store=mock_vector_store,
        embedder=mock_embedder,
        hybrid_search=search,
        rag_pipeline=rag,
        conn=seeded_conn,
    )
    set_state(state)

    # Patch get_connection to return the in-memory conn
    monkeypatch.setattr("src.utils.db._connection", seeded_conn)

    with TestClient(app, raise_server_exceptions=True) as client:
        yield client

    reset_connection()
    set_state(None)


# ── /health ───────────────────────────────────────────────────────────────────

def test_health_returns_ok(api_client):
    r = api_client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_reports_works_count(api_client):
    r = api_client.get("/health")
    assert r.json()["works_count"] == 5


def test_health_bm25_ready(api_client):
    r = api_client.get("/health")
    assert r.json()["bm25_ready"] is True


# ── /search ────────────────────────────────────────────────────────────────────

def test_search_returns_results(api_client):
    r = api_client.get("/search", params={"q": "transformer attention", "k": 3})
    assert r.status_code == 200
    data = r.json()
    assert "results" in data
    assert data["query"] == "transformer attention"


def test_search_bm25_mode(api_client):
    r = api_client.get("/search", params={"q": "BERT language", "mode": "bm25", "k": 3})
    assert r.status_code == 200
    assert r.json()["mode"] == "bm25"


def test_search_vector_mode(api_client):
    r = api_client.get("/search", params={"q": "neural network", "mode": "vector", "k": 3})
    assert r.status_code == 200
    assert r.json()["mode"] == "vector"


def test_search_invalid_mode(api_client):
    r = api_client.get("/search", params={"q": "test", "mode": "invalid"})
    assert r.status_code == 422


def test_search_year_filter(api_client):
    r = api_client.get("/search", params={"q": "transformer", "year_from": 2020, "year_to": 2022})
    assert r.status_code == 200
    for result in r.json()["results"]:
        if result.get("publication_year"):
            assert 2020 <= result["publication_year"] <= 2022


# ── /works ─────────────────────────────────────────────────────────────────────

def test_works_detail_returns_full_metadata(api_client):
    r = api_client.get("/works/W0000000001")
    assert r.status_code == 200
    data = r.json()
    assert data["work_id"] == "W0000000001"
    assert "title" in data


def test_works_not_found_404(api_client):
    r = api_client.get("/works/W9999999999")
    assert r.status_code == 404


def test_works_citations_endpoint(api_client):
    r = api_client.get("/works/W0000000002/citations")
    assert r.status_code == 200
    data = r.json()
    assert "citing" in data and "cited" in data


# ── /authors ──────────────────────────────────────────────────────────────────

def test_authors_search_returns_list(api_client, seeded_conn):
    # Seed an author
    seeded_conn.execute(
        "INSERT OR REPLACE INTO authors (author_id, display_name, works_count, cited_by_count) "
        "VALUES ('A123', 'Vaswani', 5, 1000)"
    )
    seeded_conn.commit()
    r = api_client.get("/authors/search", params={"q": "Vaswani"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ── /topics ───────────────────────────────────────────────────────────────────

def test_topics_trends_endpoint(api_client):
    r = api_client.get("/topics/trends", params={"year_from": 2017, "year_to": 2021})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_topics_concepts_endpoint(api_client):
    r = api_client.get("/topics/concepts", params={"limit": 10})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ── /graph ────────────────────────────────────────────────────────────────────

def test_graph_concept_cooccurrence_endpoint(api_client):
    r = api_client.get("/graph/concept-cooccurrence", params={"min_weight": 1})
    assert r.status_code == 200
    data = r.json()
    assert "nodes" in data and "edges" in data


# ── /rag ──────────────────────────────────────────────────────────────────────

def test_rag_answer_extractive_mode(api_client, monkeypatch):
    monkeypatch.setenv("LLM_VENDOR_API_KEY", "")
    r = api_client.post(
        "/rag/answer",
        json={"query": "transformer attention mechanism", "top_k": 3, "use_extractive_fallback": True},
    )
    assert r.status_code == 200
    data = r.json()
    assert "answer_text" in data
    assert data["mode"] == "extractive"


def test_rag_no_api_key_returns_503_for_llm_mode(api_client, monkeypatch):
    monkeypatch.delenv("LLM_VENDOR_API_KEY", raising=False)
    r = api_client.post(
        "/rag/answer",
        json={"query": "transformer attention", "top_k": 3, "use_extractive_fallback": False},
    )
    assert r.status_code == 503


def test_rag_multihop_extractive_fallback(api_client):
    r = api_client.post(
        "/rag/answer",
        json={"query": "graph neural networks", "top_k": 3, "multi_hop": True, "use_extractive_fallback": False},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["mode"] in ("multi-hop", "extractive")
    assert "answer_text" in data


def test_rag_stream_endpoint_returns_sse(api_client):
    import json
    r = api_client.post(
        "/rag/answer/stream",
        json={"query": "attention mechanism", "use_extractive_fallback": True},
        headers={"Accept": "text/event-stream"},
    )
    assert r.status_code == 200
    content = r.text
    done_lines = [
        json.loads(line[6:])
        for line in content.splitlines()
        if line.startswith("data: ")
        if json.loads(line[6:]).get("type") == "done"
    ]
    assert len(done_lines) == 1
    done = done_lines[0]
    assert "answer_text" in done
    assert "citations" in done
    assert done["mode"] == "extractive"


def test_rag_stream_has_token_events(api_client):
    import json
    r = api_client.post(
        "/rag/answer/stream",
        json={"query": "BERT language model", "use_extractive_fallback": True},
    )
    assert r.status_code == 200
    token_events = [
        json.loads(line[6:])
        for line in r.text.splitlines()
        if line.startswith("data: ")
        if json.loads(line[6:]).get("type") == "token"
    ]
    assert len(token_events) > 0


# ── /works/{id}/similar ───────────────────────────────────────────────────────

def test_similar_works_returns_list(api_client):
    r = api_client.get("/works/W0000000001/similar?k=3")
    assert r.status_code == 200
    data = r.json()
    assert data["work_id"] == "W0000000001"
    assert "similar_works" in data
    assert isinstance(data["similar_works"], list)


def test_similar_works_excludes_self(api_client, mock_vector_store):
    mock_vector_store.search.return_value = [
        {"work_id": "W0000000001", "vector_score": 1.0, "rank": 1},
        {"work_id": "W0000000002", "vector_score": 0.9, "rank": 2},
    ]
    r = api_client.get("/works/W0000000001/similar?k=3")
    assert r.status_code == 200
    ids = [w["work_id"] for w in r.json()["similar_works"]]
    assert "W0000000001" not in ids


def test_similar_works_latency_ms_present(api_client):
    r = api_client.get("/works/W0000000001/similar?k=2")
    assert r.status_code == 200
    assert "latency_ms" in r.json()


# ── /search?mode=fts ──────────────────────────────────────────────────────────

def test_search_fts_mode_returns_results_or_empty(api_client):
    r = api_client.get("/search", params={"q": "transformer", "mode": "fts", "k": 5})
    assert r.status_code == 200
    data = r.json()
    assert data["mode"] == "fts"
    assert isinstance(data["results"], list)


def test_search_fts_mode_accepted_by_validator(api_client):
    r = api_client.get("/search", params={"q": "bert", "mode": "fts", "k": 3})
    assert r.status_code != 422
