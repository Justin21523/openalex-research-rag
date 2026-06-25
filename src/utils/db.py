"""DuckDB singleton connection with schema initialisation."""

import threading
from pathlib import Path

import duckdb

from src.utils.logging import get_logger
from src.utils.paths import DUCKDB_PATH, SCHEMA_DIR

logger = get_logger(__name__)
_lock = threading.Lock()
_connection: duckdb.DuckDBPyConnection | None = None


def get_connection(db_path: str | Path | None = None) -> duckdb.DuckDBPyConnection:
    """Return the singleton DuckDB connection, creating and migrating if needed."""
    global _connection
    with _lock:
        if _connection is None:
            path = str(db_path or DUCKDB_PATH)
            logger.info("Opening DuckDB at %s", path)
            _connection = duckdb.connect(path)
            _apply_schema(_connection)
    return _connection


def _apply_schema(conn: duckdb.DuckDBPyConnection) -> None:
    """Run all SQL migration files in order."""
    sql_files = sorted(SCHEMA_DIR.glob("*.sql"))
    for sql_file in sql_files:
        logger.debug("Applying schema: %s", sql_file.name)
        conn.execute(sql_file.read_text())
    conn.commit()


def reset_connection() -> None:
    """Close and discard the singleton (useful in tests)."""
    global _connection
    with _lock:
        if _connection is not None:
            try:
                _connection.close()
            except Exception:
                pass
            _connection = None


def get_in_memory_connection() -> duckdb.DuckDBPyConnection:
    """Return a fresh in-memory connection with schema applied (for tests)."""
    conn = duckdb.connect(":memory:")
    _apply_schema(conn)
    return conn
