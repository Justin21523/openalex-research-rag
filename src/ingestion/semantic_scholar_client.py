"""Semantic Scholar Graph API client for fetching citation contexts."""

from __future__ import annotations

import time
import uuid

import httpx

from src.utils.logging import get_logger

logger = get_logger(__name__)

_S2_BASE = "https://api.semanticscholar.org/graph/v1"
_RATE_DELAY = 0.65  # ~90 req/min, safely under 100/min free tier


class SemanticScholarClient:
    """Thin client for Semantic Scholar Graph API."""

    def __init__(self, api_key: str = "") -> None:
        headers: dict[str, str] = {}
        if api_key:
            headers["x-api-key"] = api_key
        self._client = httpx.Client(
            base_url=_S2_BASE,
            headers=headers,
            timeout=30.0,
        )

    def _get(self, endpoint: str, params: dict) -> dict:
        time.sleep(_RATE_DELAY)
        resp = self._client.get(endpoint, params=params)
        if resp.status_code == 404:
            return {}
        resp.raise_for_status()
        return resp.json()

    def get_paper_id_by_doi(self, doi: str) -> str | None:
        """Look up a Semantic Scholar paper ID from a DOI."""
        try:
            data = self._get(f"/paper/DOI:{doi}", {"fields": "paperId"})
            return data.get("paperId")
        except Exception as e:
            logger.debug("S2 DOI lookup failed for %s: %s", doi, e)
            return None

    def get_references_with_contexts(
        self, paper_id: str, limit: int = 50
    ) -> list[dict]:
        """Return references with citation contexts for a given S2 paper ID.

        Each item: {cited_s2_id, context_text, section, intent, externalIds}
        """
        try:
            data = self._get(
                f"/paper/{paper_id}/references",
                {"fields": "citationContexts,externalIds,title", "limit": limit},
            )
        except Exception as e:
            logger.debug("S2 references failed for %s: %s", paper_id, e)
            return []

        results = []
        for ref in data.get("data", []):
            cited_paper = ref.get("citedPaper", {})
            contexts = ref.get("citationContexts", [])
            for ctx in contexts:
                results.append({
                    "cited_s2_id": cited_paper.get("paperId", ""),
                    "context_text": ctx.get("context", ""),
                    "section": ctx.get("sectionHeader", ""),
                    "intent": ctx.get("intents", [None])[0] if ctx.get("intents") else None,
                    "cited_external_ids": cited_paper.get("externalIds", {}),
                    "cited_title": cited_paper.get("title", ""),
                })
        return results


def fetch_and_store_citation_contexts(
    conn,
    email: str = "",
    api_key: str = "",
    limit_works: int | None = None,
) -> int:
    """Main routine: for each work with a DOI, fetch S2 citation contexts.

    Returns total context rows inserted.
    """
    client = SemanticScholarClient(api_key=api_key)

    # Load works that have a DOI
    query = "SELECT work_id, doi FROM works WHERE doi IS NOT NULL AND doi != ''"
    if limit_works:
        query += f" LIMIT {limit_works}"
    works = conn.execute(query).fetchall()
    logger.info("Processing %d works for S2 citation contexts", len(works))

    # Build a reverse map: openalex DOI → openalex work_id
    doi_to_oa_id = {doi: work_id for work_id, doi in works if doi}

    total_inserted = 0
    for work_id, doi in works:
        if not doi:
            continue
        s2_id = client.get_paper_id_by_doi(doi)
        if not s2_id:
            continue

        contexts = client.get_references_with_contexts(s2_id)
        rows = []
        for ctx in contexts:
            # Resolve cited work back to OpenAlex ID via DOI
            cited_ext = ctx.get("cited_external_ids", {})
            cited_doi = cited_ext.get("DOI", "")
            cited_oa_id = doi_to_oa_id.get(cited_doi, "")
            if not cited_oa_id:
                continue  # skip if cited work not in our DB

            rows.append({
                "id": str(uuid.uuid4()),
                "citing_work_id": work_id,
                "cited_work_id": cited_oa_id,
                "context_text": ctx["context_text"],
                "section": ctx.get("section"),
                "intent": ctx.get("intent"),
            })

        if rows:
            import pandas as pd
            import uuid as _uuid
            df = pd.DataFrame(rows)
            tmp = f"_ctx_{_uuid.uuid4().hex[:8]}"
            conn.register(tmp, df)
            conn.execute(f"INSERT OR REPLACE INTO citation_contexts SELECT * FROM {tmp}")
            conn.unregister(tmp)
            conn.commit()
            total_inserted += len(rows)
            logger.debug("Work %s: inserted %d context rows", work_id, len(rows))

    logger.info("Total citation context rows inserted: %d", total_inserted)
    return total_inserted
