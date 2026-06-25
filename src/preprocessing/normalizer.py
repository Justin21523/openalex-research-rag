"""Flatten raw OpenAlex API dicts into DuckDB-ready row dicts."""

import json

from src.preprocessing.text_cleaner import clean_text, reconstruct_abstract
from src.utils.logging import get_logger

logger = get_logger(__name__)


def extract_entity_id(openalex_url: str | None) -> str:
    """Strip OpenAlex URL prefix: 'https://openalex.org/W123' → 'W123'."""
    if not openalex_url:
        return ""
    return openalex_url.rstrip("/").split("/")[-1]


def normalize_work(raw: dict) -> dict:
    """Flatten a raw OpenAlex work dict into the works table schema."""
    work_id = extract_entity_id(raw.get("id", ""))
    title = raw.get("title") or raw.get("display_name") or ""
    abstract = reconstruct_abstract(raw.get("abstract_inverted_index"))
    abstract = clean_text(abstract)

    primary_location = raw.get("primary_location") or {}
    source = primary_location.get("source") or {}
    journal = source.get("display_name") or primary_location.get("display_name") or ""

    # Normalise referenced_works to short IDs
    ref_works = [extract_entity_id(r) for r in raw.get("referenced_works", []) if r]
    ref_works = [r for r in ref_works if r]

    return {
        "work_id": work_id,
        "title": title,
        "abstract": abstract,
        "publication_year": raw.get("publication_year"),
        "cited_by_count": raw.get("cited_by_count", 0) or 0,
        "doi": raw.get("doi"),
        "primary_location_name": journal,
        "concepts_json": json.dumps(raw.get("concepts", [])),
        "authorships_json": json.dumps(raw.get("authorships", [])),
        "referenced_works_json": json.dumps(ref_works),
        "language": raw.get("language"),
        "type": raw.get("type"),
    }


def normalize_works_batch(raw_works: list[dict]) -> list[dict]:
    """Normalise a list of raw works, skipping any that fail validation."""
    results = []
    for raw in raw_works:
        try:
            results.append(normalize_work(raw))
        except Exception as exc:
            logger.warning("Skipping work %s: %s", raw.get("id", "?"), exc)
    return results


def normalize_author(raw: dict) -> dict:
    """Flatten a raw OpenAlex author dict into the authors table schema."""
    # Handle both old (last_known_institution) and new (last_known_institutions) schema
    inst: dict = {}
    if raw.get("last_known_institution"):
        inst = raw["last_known_institution"]
    elif raw.get("last_known_institutions"):
        insts = raw["last_known_institutions"]
        inst = insts[0] if insts else {}
    elif raw.get("affiliations"):
        affiliations = raw["affiliations"]
        if affiliations:
            inst = affiliations[0].get("institution") or {}
    return {
        "author_id": extract_entity_id(raw.get("id", "")),
        "display_name": raw.get("display_name"),
        "works_count": raw.get("works_count", 0) or 0,
        "cited_by_count": raw.get("cited_by_count", 0) or 0,
        "last_institution_id": extract_entity_id(inst.get("id", "")),
        "last_institution_name": inst.get("display_name"),
        "x_concepts_json": json.dumps(raw.get("x_concepts", [])),
    }


def normalize_institution(raw: dict) -> dict:
    """Flatten a raw OpenAlex institution dict into the institutions table schema."""
    return {
        "institution_id": extract_entity_id(raw.get("id", "")),
        "display_name": raw.get("display_name"),
        "country_code": raw.get("country_code"),
        "type": raw.get("type"),
        "works_count": raw.get("works_count", 0) or 0,
        "cited_by_count": raw.get("cited_by_count", 0) or 0,
    }
