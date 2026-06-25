"""HTTP client for the OpenAlex API with polite-pool support and cursor pagination."""

import time
from collections.abc import Iterator

import httpx

from src.utils.logging import get_logger

logger = get_logger(__name__)

_BASE_URL = "https://api.openalex.org"
_RATE_DELAY = 0.12  # ~8 req/s — safely within polite pool


class OpenAlexClient:
    """Thin wrapper around the OpenAlex REST API."""

    def __init__(self, email: str = "", api_key: str = "") -> None:
        ua = f"openalex-research-rag/0.1 (mailto:{email})" if email else "openalex-research-rag/0.1"
        headers: dict[str, str] = {"User-Agent": ua}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        self._client = httpx.Client(base_url=_BASE_URL, headers=headers, timeout=30.0)

    def _get(self, endpoint: str, params: dict) -> dict:
        time.sleep(_RATE_DELAY)
        for attempt in range(5):
            resp = self._client.get(endpoint, params=params)
            if resp.status_code == 429:
                # Respect Retry-After header if present, else exponential backoff
                retry_after = resp.headers.get("retry-after")
                if retry_after:
                    wait = int(retry_after) + 10  # wait full Retry-After + buffer
                    logger.warning(
                        "429 daily quota — Retry-After=%ss, waiting %ds then retrying (attempt %d/5)",
                        retry_after, wait, attempt + 1,
                    )
                else:
                    wait = 30 * (2 ** attempt)  # 30s, 60s, 120s, 240s, 480s
                    logger.warning("429 rate limit — retrying in %ds (attempt %d/5)", wait, attempt + 1)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        resp.raise_for_status()  # final raise if all retries exhausted
        return resp.json()

    def get_works_page(
        self,
        query: str | None = None,
        filter_str: str | None = None,
        per_page: int = 25,
        cursor: str = "*",
    ) -> tuple[list[dict], str | None]:
        """Fetch one page of works. Returns (results, next_cursor)."""
        params: dict = {"per-page": per_page, "cursor": cursor}
        if query:
            params["search"] = query
        if filter_str:
            params["filter"] = filter_str
        data = self._get("/works", params)
        results = data.get("results", [])
        next_cursor = data.get("meta", {}).get("next_cursor")
        return results, next_cursor

    def get_works(
        self,
        query: str | None = None,
        filter_str: str | None = None,
        max_results: int = 200,
        per_page: int = 25,
    ) -> Iterator[dict]:
        """Cursor-paginated generator yielding individual work dicts."""
        fetched = 0
        cursor: str | None = "*"
        while cursor and fetched < max_results:
            batch_size = min(per_page, max_results - fetched)
            results, cursor = self.get_works_page(
                query=query, filter_str=filter_str, per_page=batch_size, cursor=cursor
            )
            if not results:
                break
            for work in results:
                yield work
                fetched += 1
                if fetched >= max_results:
                    return
            logger.debug("Fetched %d works so far", fetched)

    def get_work(self, work_id: str) -> dict | None:
        """Fetch a single work by short ID (e.g. 'W2741809807')."""
        try:
            return self._get(f"/works/{work_id}", {})
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    def get_authors(
        self,
        filter_str: str | None = None,
        per_page: int = 25,
        max_results: int = 100,
    ) -> list[dict]:
        """Fetch authors with optional filter."""
        params: dict = {"per-page": per_page}
        if filter_str:
            params["filter"] = filter_str
        data = self._get("/authors", params)
        return data.get("results", [])[:max_results]

    def get_institutions(
        self,
        filter_str: str | None = None,
        per_page: int = 25,
    ) -> list[dict]:
        """Fetch institutions with optional filter."""
        params: dict = {"per-page": per_page}
        if filter_str:
            params["filter"] = filter_str
        data = self._get("/institutions", params)
        return data.get("results", [])

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "OpenAlexClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
