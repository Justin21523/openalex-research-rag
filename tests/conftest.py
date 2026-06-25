"""Shared pytest fixtures."""

import json
from unittest.mock import MagicMock

import pytest

from src.features.bm25_index import BM25Index
from src.features.embeddings import WorkEmbedder
from src.utils.db import get_in_memory_connection, reset_connection


@pytest.fixture(autouse=True)
def _reset_db_singleton():
    """Ensure each test starts with a fresh DB singleton."""
    reset_connection()
    yield
    reset_connection()


@pytest.fixture
def in_memory_conn():
    return get_in_memory_connection()


@pytest.fixture
def sample_works() -> list[dict]:
    return [
        {
            "work_id": "W0000000001",
            "title": "Attention Is All You Need",
            "abstract": "We propose a new architecture called Transformer based on attention mechanisms.",
            "publication_year": 2017,
            "cited_by_count": 50000,
            "doi": "10.xxxx/transformer",
            "primary_location_name": "NeurIPS",
            "concepts_json": json.dumps([{"id": "https://openalex.org/C119857082", "display_name": "Machine learning", "score": 0.9}]),
            "authorships_json": json.dumps([{"author": {"id": "https://openalex.org/A123", "display_name": "Vaswani"}, "institutions": []}]),
            "referenced_works_json": json.dumps(["W0000000003"]),
            "language": "en",
            "type": "article",
        },
        {
            "work_id": "W0000000002",
            "title": "BERT: Pre-training of Deep Bidirectional Transformers",
            "abstract": "We introduce BERT, a language representation model for NLP.",
            "publication_year": 2019,
            "cited_by_count": 30000,
            "doi": "10.xxxx/bert",
            "primary_location_name": "NAACL",
            "concepts_json": json.dumps([{"id": "https://openalex.org/C119857082", "display_name": "Machine learning", "score": 0.85}, {"id": "https://openalex.org/C41008148", "display_name": "Computer science", "score": 0.8}]),
            "authorships_json": json.dumps([{"author": {"id": "https://openalex.org/A456", "display_name": "Devlin"}, "institutions": []}]),
            "referenced_works_json": json.dumps(["W0000000001"]),
            "language": "en",
            "type": "article",
        },
        {
            "work_id": "W0000000003",
            "title": "Graph Neural Networks for Knowledge Representation",
            "abstract": "We study graph neural networks applied to knowledge graphs and node classification.",
            "publication_year": 2020,
            "cited_by_count": 5000,
            "doi": None,
            "primary_location_name": "ICLR",
            "concepts_json": json.dumps([{"id": "https://openalex.org/C154945302", "display_name": "Artificial intelligence", "score": 0.9}]),
            "authorships_json": json.dumps([{"author": {"id": "https://openalex.org/A789", "display_name": "Kipf"}, "institutions": []}]),
            "referenced_works_json": json.dumps([]),
            "language": "en",
            "type": "article",
        },
        {
            "work_id": "W0000000004",
            "title": "Dense Passage Retrieval for Open-Domain QA",
            "abstract": "We investigate dense retrieval methods using bi-encoder models.",
            "publication_year": 2020,
            "cited_by_count": 8000,
            "doi": "10.xxxx/dpr",
            "primary_location_name": "EMNLP",
            "concepts_json": json.dumps([{"id": "https://openalex.org/C119857082", "display_name": "Machine learning", "score": 0.7}]),
            "authorships_json": json.dumps([{"author": {"id": "https://openalex.org/A999", "display_name": "Karpukhin"}, "institutions": []}]),
            "referenced_works_json": json.dumps(["W0000000001", "W0000000002"]),
            "language": "en",
            "type": "article",
        },
        {
            "work_id": "W0000000005",
            "title": "Retrieval-Augmented Generation for NLP",
            "abstract": "We present RAG, combining retrieval and generation for knowledge-intensive tasks.",
            "publication_year": 2021,
            "cited_by_count": 12000,
            "doi": "10.xxxx/rag",
            "primary_location_name": "NeurIPS",
            "concepts_json": json.dumps([{"id": "https://openalex.org/C154945302", "display_name": "Artificial intelligence", "score": 0.95}]),
            "authorships_json": json.dumps([{"author": {"id": "https://openalex.org/A111", "display_name": "Lewis"}, "institutions": []}]),
            "referenced_works_json": json.dumps(["W0000000004"]),
            "language": "en",
            "type": "article",
        },
    ]


@pytest.fixture
def seeded_conn(in_memory_conn, sample_works):
    from src.ingestion.db_writer import write_citations, write_works
    write_works(in_memory_conn, sample_works)
    write_citations(in_memory_conn, sample_works)
    return in_memory_conn


@pytest.fixture
def bm25_index(tmp_path, seeded_conn):
    idx = BM25Index(tmp_path / "test_bm25.joblib")
    idx.build(seeded_conn).save()
    return idx


@pytest.fixture
def mock_vector_store():
    vs = MagicMock()
    vs.search.return_value = [
        {"work_id": "W0000000001", "vector_score": 0.95, "rank": 1},
        {"work_id": "W0000000002", "vector_score": 0.85, "rank": 2},
        {"work_id": "W0000000003", "vector_score": 0.75, "rank": 3},
    ]
    vs.is_ready.return_value = True
    vs.count.return_value = 5
    vs.get_embedding.return_value = [0.1] * 384
    return vs


@pytest.fixture
def mock_embedder():
    emb = MagicMock(spec=WorkEmbedder)
    emb.encode_query.return_value = [0.1] * 384
    return emb
