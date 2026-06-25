#!/usr/bin/env python3
"""CLI script: fetch Semantic Scholar citation contexts for works in DuckDB.

Usage:
  python scripts/fetch_citation_contexts.py --limit 100
  python scripts/fetch_citation_contexts.py --api-key YOUR_S2_KEY
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingestion.semantic_scholar_client import fetch_and_store_citation_contexts
from src.utils.db import get_connection


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch S2 citation contexts into DuckDB")
    parser.add_argument("--api-key", default="", help="Semantic Scholar API key (optional, 100 req/min free)")
    parser.add_argument("--limit", type=int, default=None, help="Max works to process (default: all)")
    args = parser.parse_args()

    conn = get_connection()
    total = fetch_and_store_citation_contexts(
        conn=conn,
        api_key=args.api_key,
        limit_works=args.limit,
    )
    print(f"Done. Citation context rows inserted: {total:,}")


if __name__ == "__main__":
    main()
