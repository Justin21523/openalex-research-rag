"""Centralised path constants for the project."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = PROJECT_ROOT / "src"
DATA_DIR = PROJECT_ROOT / "data"
SAMPLE_DIR = DATA_DIR / "sample"
SCHEMA_DIR = DATA_DIR / "schema"
CHROMA_DIR = DATA_DIR / "chroma"
CONFIGS_DIR = PROJECT_ROOT / "configs"

DUCKDB_PATH = DATA_DIR / "openalex.duckdb"
BM25_INDEX_PATH = DATA_DIR / "bm25_index.joblib"
EVALUATION_RESULTS_PATH = DATA_DIR / "evaluation_results.json"
