"""Load pre-committed sample data from data/sample/."""

import json
from pathlib import Path

from src.utils.logging import get_logger
from src.utils.paths import SAMPLE_DIR

logger = get_logger(__name__)


def _load_json(path: Path) -> list[dict]:
    if not path.exists():
        logger.warning("Sample file not found: %s", path)
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    # Allow {results: [...]} envelope
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return []


def load_works_sample(path: Path | None = None) -> list[dict]:
    """Load raw works from data/sample/works_sample.json."""
    p = path or (SAMPLE_DIR / "works_sample.json")
    works = _load_json(p)
    logger.info("Loaded %d sample works from %s", len(works), p)
    return works


def load_authors_sample(path: Path | None = None) -> list[dict]:
    """Load raw authors from data/sample/authors_sample.json."""
    p = path or (SAMPLE_DIR / "authors_sample.json")
    authors = _load_json(p)
    logger.info("Loaded %d sample authors from %s", len(authors), p)
    return authors


def load_institutions_sample(path: Path | None = None) -> list[dict]:
    """Load raw institutions from data/sample/institutions_sample.json."""
    p = path or (SAMPLE_DIR / "institutions_sample.json")
    insts = _load_json(p)
    logger.info("Loaded %d sample institutions from %s", len(insts), p)
    return insts
