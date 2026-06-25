#!/usr/bin/env python3
"""CLI script: download arXiv PDFs and store full text in DuckDB.

Usage:
  python scripts/fetch_arxiv_pdfs.py --limit 50
  python scripts/fetch_arxiv_pdfs.py          # all arXiv works
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingestion.arxiv_pdf_fetcher import fetch_and_store_full_texts
from src.utils.db import get_connection


def main() -> None:
    parser = argparse.ArgumentParser(description="Download arXiv PDFs and store full text")
    parser.add_argument("--limit", type=int, default=None, help="Max works to process")
    parser.add_argument("--no-skip", action="store_true", help="Re-process works that already have full_text")
    args = parser.parse_args()

    conn = get_connection()
    updated = fetch_and_store_full_texts(
        conn=conn,
        limit_works=args.limit,
        skip_existing=not args.no_skip,
    )
    print(f"Done. Full text stored for {updated:,} works.")
    count = conn.execute("SELECT COUNT(*) FROM works WHERE full_text IS NOT NULL").fetchone()[0]
    print(f"Total works with full_text: {count:,}")


if __name__ == "__main__":
    main()
