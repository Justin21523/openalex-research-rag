.PHONY: all sample-data etl index evaluate api app frontend frontend-install build-frontend test lint format docker-up docker-down clean help

HF_HOME ?= $(HOME)/.cache/huggingface
PYTHONPATH ?= .
PYTHON = HF_HOME=$(HF_HOME) PYTHONPATH=$(PYTHONPATH) uv run python

# ── Default target ─────────────────────────────────────────────────────────────
all: sample-data etl index

help:
	@echo ""
	@echo "OpenAlex Research Intelligence RAG — Makefile"
	@echo "----------------------------------------------"
	@echo "  make sample-data   Fetch ~200 works from OpenAlex API → data/sample/"
	@echo "  make etl           Load sample data into DuckDB"
	@echo "  make index         Build BM25 + ChromaDB vector indexes"
	@echo "  make evaluate      Run retrieval & RAG evaluation"
	@echo "  make api           Start FastAPI server (port 8000)"
	@echo "  make app           Start Streamlit UI (port 8501)
  make frontend      Start React dev server (port 5173)
  make frontend-install  Install React npm dependencies
  make build-frontend    Build React for production"
	@echo "  make test          Run pytest test suite"
	@echo "  make lint          Lint with ruff"
	@echo "  make format        Format with ruff"
	@echo "  make docker-up     docker-compose up --build"
	@echo "  make docker-down   docker-compose down"
	@echo "  make clean         Remove generated indexes and DuckDB"
	@echo ""

# ── Data pipeline ──────────────────────────────────────────────────────────────
sample-data:
	@echo "Fetching sample data from OpenAlex API..."
	$(PYTHON) scripts/fetch_sample_data.py

etl:
	@echo "Running ETL pipeline..."
	$(PYTHON) src/ingestion/pipeline.py --sample

index:
	@echo "Building BM25, vector, and FTS indexes..."
	$(PYTHON) src/features/build_index.py

index-fts:
	@echo "Building DuckDB FTS index only..."
	$(PYTHON) src/features/build_index.py --fts-only

evaluate:
	@echo "Running evaluation..."
	$(PYTHON) src/evaluation/run_evaluation.py

# ── Services ───────────────────────────────────────────────────────────────────
api:
	@echo "Starting FastAPI server at http://localhost:8000"
	$(PYTHON) -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

app:
	@echo "Starting Streamlit UI at http://localhost:8501"
	HF_HOME=$(HF_HOME) PYTHONPATH=$(PYTHONPATH) uv run streamlit run src/app/streamlit_app.py \
		--server.port 8501 \
		--server.address 0.0.0.0

frontend-install:
	@echo "Installing React frontend dependencies..."
	cd frontend && npm install

frontend:
	@echo "Starting React dev server at http://localhost:5173"
	cd frontend && npm run dev

build-frontend:
	@echo "Building React frontend for production..."
	cd frontend && npm run build

# ── Quality ────────────────────────────────────────────────────────────────────
test:
	HF_HOME=$(HF_HOME) uv run pytest tests/ -v

lint:
	uv run ruff check src/ tests/

format:
	uv run ruff format src/ tests/

# ── Docker ─────────────────────────────────────────────────────────────────────
docker-up:
	docker-compose up --build

docker-down:
	docker-compose down

# ── Cleanup ────────────────────────────────────────────────────────────────────
clean:
	rm -f data/openalex.duckdb
	rm -f data/bm25_index.joblib
	rm -rf data/chroma/
	rm -f data/evaluation_results.json
	@echo "Cleaned generated data files."
