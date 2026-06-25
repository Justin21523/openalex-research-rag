"""Application settings via pydantic-settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from src.utils.paths import (
    BM25_INDEX_PATH,
    CHROMA_DIR,
    DUCKDB_PATH,
    PROJECT_ROOT,
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # OpenAlex
    openalex_email: str = ""
    openalex_api_key: str = ""

    # llama.cpp local LLM (OpenAI-compatible server at localhost:8080)
    llama_base_url: str = "http://localhost:8080"
    llama_model: str = "local"
    llama_max_tokens: int = 512
    llama_timeout: float = 60.0

    # Embeddings
    embeddings_model: str = "all-MiniLM-L6-v2"
    embeddings_batch_size: int = 64

    # Search
    default_k: int = 10
    rrf_k: int = 60
    rag_top_k: int = 5

    # Storage paths
    duckdb_path: str = str(DUCKDB_PATH)
    chroma_dir: str = str(CHROMA_DIR)
    bm25_index_path: str = str(BM25_INDEX_PATH)

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_base_url: str = "http://localhost:8000"
    log_level: str = "INFO"

    # CORS — comma-separated list of allowed origins, or "*" for any (default).
    # e.g. CORS_ORIGINS="https://app.example.com,https://www.example.com"
    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
