"""Tests for citation graph — write_citations, neighbors, concept co-occurrence, topic trends."""

import json

import pytest

from src.features.concept_graph import build_concept_cooccurrence, get_top_concepts_by_year
from src.ingestion.db_writer import write_citations, write_works
from src.retrieval.duckdb_store import get_citation_neighbors, get_topic_trends


def test_write_citations_inserts_rows(seeded_conn):
    count = seeded_conn.execute("SELECT COUNT(*) FROM citations").fetchone()[0]
    assert count > 0


def test_citation_neighbors_out_direction(seeded_conn):
    # W0000000002 cites W0000000001
    neighbors = get_citation_neighbors(seeded_conn, "W0000000002", direction="out")
    cited_ids = [c["work_id"] for c in neighbors["cited"]]
    assert "W0000000001" in cited_ids


def test_citation_neighbors_in_direction(seeded_conn):
    # W0000000001 is cited by W0000000002
    neighbors = get_citation_neighbors(seeded_conn, "W0000000001", direction="in")
    citing_ids = [c["work_id"] for c in neighbors["citing"]]
    assert "W0000000002" in citing_ids


def test_citation_neighbors_both_directions(seeded_conn):
    neighbors = get_citation_neighbors(seeded_conn, "W0000000004", direction="both")
    assert "citing" in neighbors and "cited" in neighbors


def test_citation_neighbors_empty_for_isolated_work(seeded_conn):
    # W0000000003 has no referenced_works, and no one cites it in sample (W0000000001 does via fixture)
    neighbors = get_citation_neighbors(seeded_conn, "W0000000999", direction="both")
    assert neighbors["total_citing"] == 0
    assert neighbors["total_cited"] == 0


def test_concept_cooccurrence_builds_nodes(seeded_conn):
    result = build_concept_cooccurrence(seeded_conn, min_weight=1)
    assert "nodes" in result
    assert len(result["nodes"]) > 0


def test_concept_cooccurrence_edges_have_weights(seeded_conn):
    result = build_concept_cooccurrence(seeded_conn, min_weight=1)
    for edge in result["edges"]:
        assert edge["weight"] >= 1
        assert "source" in edge and "target" in edge


def test_concept_cooccurrence_min_weight_filter(seeded_conn):
    all_result = build_concept_cooccurrence(seeded_conn, min_weight=1)
    filtered = build_concept_cooccurrence(seeded_conn, min_weight=100)
    # High min_weight should give fewer edges
    assert len(filtered["edges"]) <= len(all_result["edges"])


def test_topic_trends_by_year_range(seeded_conn):
    trends = get_topic_trends(seeded_conn, year_from=2017, year_to=2021)
    for t in trends:
        assert 2017 <= t["year"] <= 2021
        assert t["count"] > 0


def test_top_concepts_by_year_returns_dict(seeded_conn):
    result = get_top_concepts_by_year(seeded_conn, year_from=2017, year_to=2021)
    assert isinstance(result, dict)
    for year, concepts in result.items():
        assert isinstance(concepts, list)
