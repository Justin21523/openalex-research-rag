"""Bulk fetch ~50k works from OpenAlex API across multiple topics/keywords."""

from __future__ import annotations

import time
from collections.abc import Callable, Iterator
from typing import Any

import duckdb
from tqdm import tqdm

from src.ingestion.db_writer import write_citations, write_works
from src.preprocessing.normalizer import normalize_works_batch
from src.ingestion.openalex_client import OpenAlexClient
from src.utils.logging import get_logger

logger = get_logger(__name__)

# Eight diverse research domains (~6,250 each = ~50k total)
DEFAULT_TOPICS = [
    ("machine learning", 6500),
    ("natural language processing", 6500),
    ("computer vision", 6500),
    ("information retrieval", 6000),
    ("knowledge graph", 5500),
    ("bioinformatics", 5500),
    ("climate change", 5500),
    ("reinforcement learning", 6000),
]


def fetch_bulk(
    conn: duckdb.DuckDBPyConnection,
    email: str = "",
    api_key: str = "",
    topics: list[tuple[str, int]] | None = None,
    on_progress: Callable[[str, int, int], None] | None = None,
    batch_size: int = 200,
    filter_str: str | None = None,
) -> int:
    """Fetch works from OpenAlex and upsert into DuckDB.

    Args:
        conn: DuckDB connection.
        email: OpenAlex polite-pool email.
        api_key: Optional premium API key.
        topics: List of (keyword, max_count) pairs.
        on_progress: Callback(topic, fetched_this_topic, total_fetched).
        batch_size: Works per write batch.
        filter_str: Additional OpenAlex filter (e.g. "open_access.is_oa:true").

    Returns:
        Total new works upserted.
    """
    client = OpenAlexClient(email=email, api_key=api_key)
    topics_list = topics or DEFAULT_TOPICS
    total_upserted = 0

    for topic, max_count in topics_list:
        logger.info("Fetching topic '%s' (max %d)", topic, max_count)
        topic_fetched = 0
        batch: list[dict] = []

        gen: Iterator[dict] = client.get_works(
            query=topic,
            filter_str=filter_str,
            max_results=max_count,
            per_page=min(200, max_count),
        )

        for raw_work in gen:
            batch.append(raw_work)
            topic_fetched += 1

            if len(batch) >= batch_size:
                _flush(conn, batch)
                total_upserted += len(batch)
                batch = []
                if on_progress:
                    on_progress(topic, topic_fetched, total_upserted)

        if batch:
            _flush(conn, batch)
            total_upserted += len(batch)
            if on_progress:
                on_progress(topic, topic_fetched, total_upserted)

        logger.info("Topic '%s' done: %d works, running total %d", topic, topic_fetched, total_upserted)

    return total_upserted


def _flush(conn: duckdb.DuckDBPyConnection, raw_works: list[dict]) -> None:
    """Normalise and upsert a batch of raw OpenAlex work dicts."""
    normalised = normalize_works_batch(raw_works)
    write_works(conn, normalised)
    write_citations(conn, normalised)
