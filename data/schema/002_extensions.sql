-- Schema extensions: full-text, citation contexts, annotations, conversations
-- All statements are idempotent (IF NOT EXISTS / IF COLUMN NOT EXISTS pattern)

-- Full-text and arXiv ID on works
ALTER TABLE works ADD COLUMN IF NOT EXISTS full_text TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS arxiv_id VARCHAR;

-- Semantic Scholar citation contexts
CREATE TABLE IF NOT EXISTS citation_contexts (
    id VARCHAR PRIMARY KEY,
    citing_work_id VARCHAR NOT NULL,
    cited_work_id VARCHAR NOT NULL,
    context_text TEXT,
    section VARCHAR,
    intent VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Per-paper annotations / notes
CREATE TABLE IF NOT EXISTS annotations (
    annotation_id VARCHAR PRIMARY KEY,
    work_id VARCHAR NOT NULL,
    note_text TEXT,
    highlighted_text TEXT,
    color VARCHAR DEFAULT 'yellow',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- RAG multi-turn conversation sessions
CREATE TABLE IF NOT EXISTS conversation_sessions (
    session_id VARCHAR PRIMARY KEY,
    title VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active_at TIMESTAMP DEFAULT NOW()
);

-- RAG conversation messages
CREATE TABLE IF NOT EXISTS conversation_messages (
    message_id VARCHAR PRIMARY KEY,
    session_id VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    content TEXT,
    citations_json JSON,
    evidence_works_json JSON,
    hop_works_json JSON,
    mode VARCHAR,
    latency_ms FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);
