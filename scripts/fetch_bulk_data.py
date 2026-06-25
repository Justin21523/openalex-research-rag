#!/usr/bin/env python3
"""CLI script: bulk-fetch works from OpenAlex into DuckDB.

Usage:
  python scripts/fetch_bulk_data.py --topic "machine learning" --limit 1000
  python scripts/fetch_bulk_data.py --all-topics --limit-per-topic 6500
  python scripts/fetch_bulk_data.py --email you@example.com --all-topics
"""

import argparse
import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent.parent))

from tqdm import tqdm

from src.ingestion.bulk_fetcher import DEFAULT_TOPICS, fetch_bulk
from src.utils.db import get_connection


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk-fetch OpenAlex works into DuckDB")
    parser.add_argument("--email", default="", help="OpenAlex polite-pool email")
    parser.add_argument("--api-key", default="", help="Optional OpenAlex API key")
    parser.add_argument("--topic", default="", help="Single topic/keyword to fetch")
    parser.add_argument("--limit", type=int, default=500, help="Max works for --topic")
    parser.add_argument("--all-topics", action="store_true", help="Fetch all 8 default topics")
    parser.add_argument("--limit-per-topic", type=int, default=6500, help="Max per topic when --all-topics")
    args = parser.parse_args()

    conn = get_connection()

    if args.all_topics:
        topics = [(name, args.limit_per_topic) for name, _ in DEFAULT_TOPICS]
        print(f"Fetching {len(topics)} topics × up to {args.limit_per_topic} each "
              f"(target: ~{len(topics) * args.limit_per_topic:,} works)")
    elif args.topic:
        topics = [(args.topic, args.limit)]
        print(f"Fetching topic '{args.topic}' (limit {args.limit})")
    else:
        print("Error: specify --topic KEYWORD or --all-topics", file=sys.stderr)
        sys.exit(1)

    bar = tqdm(total=sum(lim for _, lim in topics), unit="works")
    last_total = [0]

    def on_progress(topic: str, fetched: int, total: int) -> None:
        delta = total - last_total[0]
        last_total[0] = total
        bar.update(delta)
        bar.set_description(f"{topic[:30]}")

    total = fetch_bulk(
        conn=conn,
        email=args.email,
        api_key=args.api_key,
        topics=topics,
        on_progress=on_progress,
    )
    bar.close()
    print(f"\nDone. Total works upserted: {total:,}")

    # Report DB count
    count = conn.execute("SELECT COUNT(*) FROM works").fetchone()[0]
    print(f"Total works in DuckDB: {count:,}")


if __name__ == "__main__":
    main()
