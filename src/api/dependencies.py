"""FastAPI dependency providers."""

from collections.abc import Generator

import duckdb
from fastapi import Depends

from src.api.state import AppState, get_state
from src.utils.db import get_connection


def get_conn() -> Generator[duckdb.DuckDBPyConnection, None, None]:
    yield get_connection()


def get_app_state() -> AppState:
    return get_state()
