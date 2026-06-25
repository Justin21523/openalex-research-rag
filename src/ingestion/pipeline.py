"""Full ETL orchestrator — sample data or live OpenAlex API."""

import argparse

from src.ingestion.db_writer import write_authors, write_citations, write_institutions, write_works
from src.ingestion.openalex_client import OpenAlexClient
from src.ingestion.sample_loader import load_authors_sample, load_institutions_sample, load_works_sample
from src.preprocessing.deduplicator import deduplicate_by_doi, deduplicate_works
from src.preprocessing.normalizer import normalize_author, normalize_institution, normalize_works_batch
from src.utils.config import get_settings
from src.utils.db import get_connection
from src.utils.logging import get_logger, setup_logging

logger = get_logger(__name__)


def run_pipeline(
    use_sample: bool = True,
    max_results: int = 200,
    query: str | None = None,
    topic_filter: str | None = None,
) -> None:
    """Run the full ingestion ETL pipeline."""
    setup_logging()
    settings = get_settings()
    conn = get_connection()

    # ── 1. Load raw works ──────────────────────────────────────────────────
    if use_sample:
        logger.info("Loading from sample files …")
        raw_works = load_works_sample()
        raw_authors = load_authors_sample()
        raw_institutions = load_institutions_sample()
    else:
        logger.info("Fetching from OpenAlex API (max %d works) …", max_results)
        client = OpenAlexClient(
            email=settings.openalex_email,
            api_key=settings.openalex_api_key,
        )
        raw_works = list(
            client.get_works(
                query=query,
                filter_str=topic_filter,
                max_results=max_results,
            )
        )
        raw_authors = client.get_authors(max_results=100)
        raw_institutions = client.get_institutions()
        client.close()

    logger.info("Raw records: %d works, %d authors, %d institutions",
                len(raw_works), len(raw_authors), len(raw_institutions))

    # ── 2. Normalise & deduplicate ─────────────────────────────────────────
    works = normalize_works_batch(raw_works)
    works = deduplicate_works(works)
    works = deduplicate_by_doi(works)
    works = [w for w in works if w.get("work_id")]

    authors = [normalize_author(a) for a in raw_authors if a.get("id")]
    institutions = [normalize_institution(i) for i in raw_institutions if i.get("id")]

    logger.info("After dedup: %d works, %d authors, %d institutions",
                len(works), len(authors), len(institutions))

    # ── 3. Write to DuckDB ─────────────────────────────────────────────────
    write_works(conn, works)
    write_citations(conn, works)
    if authors:
        write_authors(conn, authors)
    if institutions:
        write_institutions(conn, institutions)

    # ── 4. Summary ─────────────────────────────────────────────────────────
    counts = conn.execute(
        "SELECT 'works' t, COUNT(*) n FROM works "
        "UNION ALL SELECT 'citations', COUNT(*) FROM citations "
        "UNION ALL SELECT 'authors', COUNT(*) FROM authors "
        "UNION ALL SELECT 'institutions', COUNT(*) FROM institutions"
    ).fetchall()
    for table, count in counts:
        logger.info("  %-15s %d rows", table, count)

    logger.info("ETL complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpenAlex ETL pipeline")
    parser.add_argument("--sample", action="store_true", default=True, help="Use sample data")
    parser.add_argument("--live", action="store_true", help="Fetch from live OpenAlex API")
    parser.add_argument("--limit", type=int, default=200, help="Max works to fetch (live mode)")
    parser.add_argument("--query", type=str, default=None, help="Search query (live mode)")
    parser.add_argument("--filter", type=str, default=None, dest="topic_filter",
                        help="OpenAlex filter string (live mode)")
    args = parser.parse_args()

    run_pipeline(
        use_sample=not args.live,
        max_results=args.limit,
        query=args.query,
        topic_filter=args.topic_filter,
    )
