"""HTTP helpers for Streamlit pages to call the FastAPI backend."""

import os

import httpx
import streamlit as st

_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
_TIMEOUT = 30.0


def _base() -> str:
    return _BASE_URL.rstrip("/")


def api_get(path: str, params: dict | None = None) -> dict | list | None:
    """GET request to the API. Displays st.error on failure, returns None."""
    try:
        url = f"{_base()}{path}"
        r = httpx.get(url, params=params or {}, timeout=_TIMEOUT)
        r.raise_for_status()
        return r.json()
    except httpx.ConnectError:
        st.error(
            f"Cannot connect to API at {_base()}. "
            "Run `make api` in a separate terminal."
        )
        return None
    except httpx.HTTPStatusError as e:
        st.error(f"API error {e.response.status_code}: {e.response.text[:200]}")
        return None
    except Exception as e:
        st.error(f"Unexpected error: {e}")
        return None


def api_post(path: str, body: dict) -> dict | None:
    """POST request to the API. Displays st.error on failure, returns None."""
    try:
        url = f"{_base()}{path}"
        r = httpx.post(url, json=body, timeout=_TIMEOUT)
        r.raise_for_status()
        return r.json()
    except httpx.ConnectError:
        st.error(
            f"Cannot connect to API at {_base()}. "
            "Run `make api` in a separate terminal."
        )
        return None
    except httpx.HTTPStatusError as e:
        st.error(f"API error {e.response.status_code}: {e.response.text[:200]}")
        return None
    except Exception as e:
        st.error(f"Unexpected error: {e}")
        return None
