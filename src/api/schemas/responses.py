"""Pydantic response models for all API endpoints."""

from pydantic import BaseModel


class WorkHit(BaseModel):
    work_id: str
    title: str | None = None
    abstract: str | None = None
    publication_year: int | None = None
    cited_by_count: int = 0
    doi: str | None = None
    journal: str | None = None
    language: str | None = None
    work_type: str | None = None
    bm25_score: float | None = None
    vector_score: float | None = None
    rrf_score: float | None = None
    rerank_score: float | None = None
    rank: int = 0


class WorkRef(BaseModel):
    work_id: str
    title: str | None = None
    publication_year: int | None = None


class WorkDetail(BaseModel):
    work_id: str
    title: str | None = None
    abstract: str | None = None
    publication_year: int | None = None
    cited_by_count: int = 0
    doi: str | None = None
    journal: str | None = None
    authors: list[dict] = []
    concepts: list[dict] = []
    language: str | None = None
    type: str | None = None


class CitationGraph(BaseModel):
    work_id: str
    citing: list[WorkRef] = []
    cited: list[WorkRef] = []
    total_citing: int = 0
    total_cited: int = 0


class SearchResponse(BaseModel):
    query: str
    mode: str
    k: int
    total: int
    latency_ms: float
    results: list[WorkHit]


class AuthorDetail(BaseModel):
    author_id: str
    display_name: str | None = None
    works_count: int = 0
    cited_by_count: int = 0
    institution_name: str | None = None
    h_index: int = 0
    recent_works: list[WorkHit] = []
    all_works: list[WorkHit] = []


class InstitutionDetail(BaseModel):
    institution_id: str
    display_name: str | None = None
    country_code: str | None = None
    type: str | None = None
    works_count: int = 0
    cited_by_count: int = 0


class TopicTrend(BaseModel):
    year: int
    count: int
    avg_cited_by_count: float = 0.0
    citation_velocity: float | None = None


class ConceptStats(BaseModel):
    concept_id: str
    concept_name: str
    work_count: int


class ConceptNode(BaseModel):
    id: str
    name: str
    count: int


class ConceptEdge(BaseModel):
    source: str
    target: str
    weight: int


class ConceptGraph(BaseModel):
    nodes: list[ConceptNode] = []
    edges: list[ConceptEdge] = []


class RAGRequest(BaseModel):
    query: str
    top_k: int = 5
    use_extractive_fallback: bool = False
    multi_hop: bool = False


class RAGResponse(BaseModel):
    query: str
    answer_text: str
    citations: list[str] = []
    evidence_works: list[WorkHit] = []
    hop_works: list[WorkHit] = []
    latency_ms: float
    mode: str


class SimilarWorksResponse(BaseModel):
    work_id: str
    similar_works: list[WorkHit] = []
    latency_ms: float


class HealthResponse(BaseModel):
    status: str
    version: str
    duckdb: str
    works_count: int
    chromadb_count: int
    bm25_ready: bool
    llm_available: bool = False


# ── Pipeline trace schemas ──────────────────────────────────────────────────

class SampleWork(BaseModel):
    work_id: str
    title: str | None = None
    abstract_preview: str = ""
    concepts_preview: list[str] = []
    referenced_works_count: int = 0
    publication_year: int | None = None


class TextCleaningInfo(BaseModel):
    raw_title: str
    clean_title: str
    query_tokens: list[str]
    searchable_text_preview: str


class BM25TokenInfo(BaseModel):
    token: str
    idf_score: float = 0.0


class BM25StageInfo(BaseModel):
    query_tokens: list[str]
    token_info: list[BM25TokenInfo] = []
    corpus_size: int
    results: list[WorkHit] = []


class VectorStageInfo(BaseModel):
    embedding_dim: int
    embedding_sample: list[float] = []
    model_name: str
    results: list[WorkHit] = []


class HybridStageInfo(BaseModel):
    rrf_k: int = 60
    results: list[WorkHit] = []


class RagContextInfo(BaseModel):
    context_preview: str
    context_char_length: int
    estimated_tokens: int
    works_used: list[WorkHit] = []


class AnswerInfo(BaseModel):
    answer_text: str
    citations: list[str] = []
    mode: str
    latency_ms: float


class PipelineTraceResponse(BaseModel):
    query: str
    sample_work: SampleWork
    text_cleaning: TextCleaningInfo
    bm25: BM25StageInfo
    vector: VectorStageInfo
    hybrid: HybridStageInfo
    rag_context: RagContextInfo
    answer: AnswerInfo
    latencies_ms: dict[str, float] = {}


# ── Playground schemas ──────────────────────────────────────────────────────

class UploadResult(BaseModel):
    count: int
    format_detected: str          # "simple_json" | "csv" | "openalex_json"
    duplicate_skipped: int = 0
    sample_works: list[dict] = []  # first 3 for preview
    latency_ms: float


class BuildResult(BaseModel):
    index_type: str               # "bm25" | "vector" | "fts"
    doc_count: int
    extra: dict = {}              # vocab_size (BM25) | embedding_dim (vector)
    build_time_ms: float


class EvalModeResult(BaseModel):
    latency_p50_ms: float
    latency_p99_ms: float
    latency_mean_ms: float
    avg_result_count: float


class EvaluationResult(BaseModel):
    modes: dict[str, EvalModeResult]
    corpus_total: int
    user_uploaded: int
    queries_run: int
    test_queries: list[str]
