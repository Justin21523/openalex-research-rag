"""Fetch arXiv PDFs for works with arXiv DOIs and extract full text."""

from __future__ import annotations

import re
import time

import httpx

from src.utils.logging import get_logger

logger = get_logger(__name__)

_ARXIV_PDF_TEMPLATE = "https://arxiv.org/pdf/{arxiv_id}.pdf"
_RATE_DELAY = 3.0  # Be polite to arXiv — 1 request per 3 seconds


def extract_arxiv_id(doi: str | None) -> str | None:
    """Extract arXiv ID from a DOI string.

    Handles:
      - 10.48550/arXiv.2401.01234
      - 10.48550/arxiv.2401.01234
    """
    if not doi:
        return None
    m = re.search(r"arxiv[./](\d{4}\.\d{4,5})", doi, re.IGNORECASE)
    return m.group(1) if m else None


def fetch_pdf_text(arxiv_id: str, client: httpx.Client) -> str | None:
    """Download arXiv PDF and extract plain text. Returns None on failure."""
    try:
        import pypdf  # lazy import — not required for core functionality
    except ImportError:
        logger.warning("pypdf not installed; cannot extract PDF text. Run: pip install pypdf")
        return None

    url = _ARXIV_PDF_TEMPLATE.format(arxiv_id=arxiv_id)
    time.sleep(_RATE_DELAY)
    try:
        resp = client.get(url, follow_redirects=True, timeout=60.0)
        resp.raise_for_status()
    except Exception as e:
        logger.debug("Failed to download %s: %s", url, e)
        return None

    try:
        import io
        reader = pypdf.PdfReader(io.BytesIO(resp.content))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n\n".join(p.strip() for p in pages if p.strip())
        return text[:500_000] or None  # cap at 500k chars
    except Exception as e:
        logger.debug("Failed to parse PDF for arXiv:%s: %s", arxiv_id, e)
        return None


def fetch_and_store_full_texts(
    conn,
    limit_works: int | None = None,
    skip_existing: bool = True,
) -> int:
    """Main routine: find arXiv works, download PDFs, store full_text.

    Returns count of works updated.
    """
    filters = ["doi LIKE '10.48550/%'"]
    if skip_existing:
        filters.append("(full_text IS NULL OR full_text = '')")
    where = " AND ".join(filters)
    query = f"SELECT work_id, doi FROM works WHERE {where}"
    if limit_works:
        query += f" LIMIT {limit_works}"

    works = conn.execute(query).fetchall()
    logger.info("Found %d arXiv works to process", len(works))

    client = httpx.Client(
        headers={"User-Agent": "openalex-research-rag/0.1 (research project)"},
        timeout=60.0,
    )
    updated = 0
    try:
        for work_id, doi in works:
            arxiv_id = extract_arxiv_id(doi)
            if not arxiv_id:
                continue

            logger.debug("Fetching arXiv:%s for work %s", arxiv_id, work_id)
            text = fetch_pdf_text(arxiv_id, client)
            if text:
                conn.execute(
                    "UPDATE works SET full_text = ?, arxiv_id = ? WHERE work_id = ?",
                    [text, arxiv_id, work_id],
                )
                conn.commit()
                updated += 1
                logger.debug("Stored full_text for %s (%d chars)", work_id, len(text))
    finally:
        client.close()

    logger.info("Full-text stored for %d works", updated)
    return updated
