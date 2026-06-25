-- OpenAlex Research Intelligence RAG — DuckDB schema

CREATE TABLE IF NOT EXISTS works (
    work_id               VARCHAR PRIMARY KEY,
    title                 VARCHAR,
    abstract              TEXT,
    publication_year      INTEGER,
    cited_by_count        INTEGER DEFAULT 0,
    doi                   VARCHAR,
    primary_location_name VARCHAR,
    concepts_json         JSON,
    authorships_json      JSON,
    referenced_works_json JSON,
    language              VARCHAR,
    type                  VARCHAR,
    created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS citations (
    citing_work_id  VARCHAR NOT NULL,
    cited_work_id   VARCHAR NOT NULL,
    PRIMARY KEY (citing_work_id, cited_work_id)
);

CREATE TABLE IF NOT EXISTS authors (
    author_id             VARCHAR PRIMARY KEY,
    display_name          VARCHAR,
    works_count           INTEGER DEFAULT 0,
    cited_by_count        INTEGER DEFAULT 0,
    last_institution_id   VARCHAR,
    last_institution_name VARCHAR,
    x_concepts_json       JSON,
    created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS institutions (
    institution_id VARCHAR PRIMARY KEY,
    display_name   VARCHAR,
    country_code   VARCHAR,
    type           VARCHAR,
    works_count    INTEGER DEFAULT 0,
    cited_by_count INTEGER DEFAULT 0,
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS query_logs (
    query_id      VARCHAR PRIMARY KEY,
    query_text    VARCHAR,
    mode          VARCHAR,
    k             INTEGER,
    results_count INTEGER,
    latency_ms    FLOAT,
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_cache (
    cache_key      VARCHAR PRIMARY KEY,
    query          VARCHAR,
    answer_text    TEXT,
    citations_json JSON,
    mode           VARCHAR,
    created_at     TIMESTAMP DEFAULT NOW()
);
