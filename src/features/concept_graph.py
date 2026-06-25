"""Concept co-occurrence graph and topic trend utilities."""

import json
from itertools import combinations

import duckdb

from src.utils.logging import get_logger

logger = get_logger(__name__)


def build_concept_cooccurrence(
    conn: duckdb.DuckDBPyConnection,
    min_weight: int = 2,
    top_n: int = 30,
) -> dict:
    """Build concept co-occurrence graph from work concepts.

    Returns {"nodes": [...], "edges": [...]} suitable for Plotly network viz.
    """
    rows = conn.execute("SELECT concepts_json FROM works WHERE concepts_json IS NOT NULL").fetchall()

    node_counts: dict[str, dict] = {}
    edge_weights: dict[tuple[str, str], int] = {}

    for (concepts_json,) in rows:
        try:
            concepts = json.loads(concepts_json or "[]")
        except Exception:
            continue
        # Take top-5 concepts by score per work (avoid noise)
        concepts = sorted(concepts, key=lambda c: c.get("score", 0), reverse=True)[:5]
        ids = [(c.get("id", "").split("/")[-1], c.get("display_name", "")) for c in concepts]
        ids = [(cid, name) for cid, name in ids if cid and name]

        for cid, name in ids:
            if cid not in node_counts:
                node_counts[cid] = {"id": cid, "name": name, "count": 0}
            node_counts[cid]["count"] += 1

        for (cid1, _), (cid2, _) in combinations(ids, 2):
            key = (min(cid1, cid2), max(cid1, cid2))
            edge_weights[key] = edge_weights.get(key, 0) + 1

    # Filter by min_weight and keep top nodes
    top_node_ids = {
        n["id"]
        for n in sorted(node_counts.values(), key=lambda x: -x["count"])[:top_n]
    }
    nodes = [n for n in node_counts.values() if n["id"] in top_node_ids]
    edges = [
        {"source": src, "target": tgt, "weight": w}
        for (src, tgt), w in edge_weights.items()
        if w >= min_weight and src in top_node_ids and tgt in top_node_ids
    ]

    logger.debug("Concept graph: %d nodes, %d edges", len(nodes), len(edges))
    return {"nodes": nodes, "edges": edges}


def get_top_concepts_by_year(
    conn: duckdb.DuckDBPyConnection,
    top_n: int = 10,
    year_from: int = 2015,
    year_to: int = 2024,
) -> dict[int, list[dict]]:
    """Return top-N concepts per publication year."""
    rows = conn.execute(
        "SELECT publication_year, concepts_json FROM works WHERE publication_year BETWEEN ? AND ?",
        [year_from, year_to],
    ).fetchall()

    year_counts: dict[int, dict[str, int]] = {}
    for year, concepts_json in rows:
        if year is None:
            continue
        try:
            concepts = json.loads(concepts_json or "[]")
        except Exception:
            continue
        if year not in year_counts:
            year_counts[year] = {}
        for c in concepts:
            name = c.get("display_name", "")
            if name:
                year_counts[year][name] = year_counts[year].get(name, 0) + 1

    return {
        year: [{"concept_name": name, "count": cnt} for name, cnt in
               sorted(counts.items(), key=lambda x: -x[1])[:top_n]]
        for year, counts in sorted(year_counts.items())
    }
