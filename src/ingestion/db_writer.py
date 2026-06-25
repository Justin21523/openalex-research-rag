"""Upsert normalised records into DuckDB tables."""

import json
import uuid

import duckdb
import pandas as pd

from src.utils.logging import get_logger

logger = get_logger(__name__)

# Explicit column lists — exclude auto-populated columns like created_at
_WORK_COLS = [
    "work_id", "title", "abstract", "publication_year", "cited_by_count",
    "doi", "primary_location_name", "concepts_json", "authorships_json",
    "referenced_works_json", "language", "type",
]
_AUTHOR_COLS = [
    "author_id", "display_name", "works_count", "cited_by_count",
    "last_institution_id", "last_institution_name", "x_concepts_json",
]
_INST_COLS = [
    "institution_id", "display_name", "country_code", "type",
    "works_count", "cited_by_count",
]


def _df_upsert(
    conn: duckdb.DuckDBPyConnection,
    table: str,
    rows: list[dict],
    cols: list[str] | None = None,
) -> int:
    """Register rows as a temp DataFrame and INSERT OR REPLACE into table."""
    if not rows:
        return 0
    df = pd.DataFrame(rows)
    if cols:
        df = df[[c for c in cols if c in df.columns]]
    tmp = f"_upsert_{uuid.uuid4().hex[:8]}"
    conn.register(tmp, df)
    col_clause = ", ".join(df.columns)
    conn.execute(f"INSERT OR REPLACE INTO {table} ({col_clause}) SELECT * FROM {tmp}")
    conn.unregister(tmp)
    conn.commit()
    return len(rows)


def write_works(conn: duckdb.DuckDBPyConnection, works: list[dict]) -> int:
    """Upsert normalised work dicts into the works table."""
    n = _df_upsert(conn, "works", works, _WORK_COLS)
    logger.info("Upserted %d works", n)
    return n


def write_citations(conn: duckdb.DuckDBPyConnection, works: list[dict]) -> int:
    """Expand referenced_works_json into citation rows."""
    rows = []
    for w in works:
        citing = w.get("work_id", "")
        if not citing:
            continue
        try:
            refs = json.loads(w.get("referenced_works_json") or "[]")
        except (json.JSONDecodeError, TypeError):
            refs = []
        for cited in refs:
            if cited and cited != citing:
                rows.append({"citing_work_id": citing, "cited_work_id": cited})

    if not rows:
        return 0

    df = pd.DataFrame(rows).drop_duplicates()
    tmp = f"_cite_{uuid.uuid4().hex[:8]}"
    conn.register(tmp, df)
    conn.execute(f"INSERT OR REPLACE INTO citations SELECT * FROM {tmp}")
    conn.unregister(tmp)
    conn.commit()
    logger.info("Upserted %d citation rows", len(df))
    return len(df)


def write_authors(conn: duckdb.DuckDBPyConnection, authors: list[dict]) -> int:
    """Upsert normalised author dicts into the authors table."""
    n = _df_upsert(conn, "authors", authors, _AUTHOR_COLS)
    logger.info("Upserted %d authors", n)
    return n


def write_institutions(conn: duckdb.DuckDBPyConnection, institutions: list[dict]) -> int:
    """Upsert normalised institution dicts into the institutions table."""
    n = _df_upsert(conn, "institutions", institutions, _INST_COLS)
    logger.info("Upserted %d institutions", n)
    return n
