"""Deduplication utilities for normalised work records."""


def deduplicate_works(works: list[dict]) -> list[dict]:
    """Remove records with duplicate work_id (last-seen wins)."""
    seen: dict[str, dict] = {}
    for w in works:
        wid = w.get("work_id", "")
        if wid:
            seen[wid] = w
    return list(seen.values())


def deduplicate_by_doi(works: list[dict]) -> list[dict]:
    """Secondary dedup: remove records sharing the same non-null DOI."""
    seen_doi: set[str] = set()
    result = []
    for w in works:
        doi = w.get("doi")
        if doi and doi in seen_doi:
            continue
        if doi:
            seen_doi.add(doi)
        result.append(w)
    return result
