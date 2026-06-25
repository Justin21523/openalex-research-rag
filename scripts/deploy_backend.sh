#!/usr/bin/env bash
# Deploy the FULL backend (FastAPI + DuckDB + ChromaDB + BM25 + embedding model) to
# the dothost server as a Docker container. The LLM (llama.cpp) stays on your LOCAL
# machine and is reached via the reverse tunnel (scripts/tunnel_llama.sh).
#
# The server is flaky, so the ~2GB data is sent with rsync --partial --append-verify
# (RESUMABLE across drops). Run from a network that can reach SSH port 2965:
#
#   SSHPASS='NeoJustin007!' bash scripts/deploy_backend.sh
#
set -uo pipefail
SSH_USER="neojustin"; SSH_HOST="${SSH_HOST:-live.dothost.net}"; SSH_PORT="2965"
REMOTE="/home/${SSH_USER}/openalex"          # server-side app+data root
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_SRC="${EMBEDDINGS_MODEL:-$HOME/.cache/openalex-models/all-MiniLM-L6-v2}"
: "${SSHPASS:?export SSHPASS first}"; export SSHPASS

SSHCMD="sshpass -e ssh -p $SSH_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=20 -o ServerAliveInterval=10"
rsync_resume() {  # rsync_resume <src> <remote-rel-dir>
  local src="$1" dst="$2"
  until rsync -az --partial --append-verify --timeout=40 --info=progress2 \
        -e "$SSHCMD" "$src" "${SSH_USER}@${SSH_HOST}:${REMOTE}/${dst}"; do
    echo "  rsync dropped — resuming in 6s: $src"; sleep 6
  done
}
ssh_retry() { until $SSHCMD "${SSH_USER}@${SSH_HOST}" "$1"; do echo "  ssh retry…"; sleep 6; done; }

echo "1) remote dirs"; ssh_retry "mkdir -p '${REMOTE}/data' '${REMOTE}/models'"

echo "2) code (git clone/pull on the server — small)"
ssh_retry "cd '${REMOTE}' && (git -C app pull -q || git clone -q https://github.com/Justin21523/openalex-research-rag.git app)"

echo "3) data (RESUMABLE ~2GB) — DuckDB, ChromaDB, BM25"
rsync_resume "${ROOT}/data/openalex.duckdb" "data/"
rsync_resume "${ROOT}/data/bm25_index.joblib" "data/"
rsync_resume "${ROOT}/data/chroma/" "data/chroma/"

echo "4) embedding model (~88MB, native copy)"
rsync_resume "${MODEL_SRC}/" "models/all-MiniLM-L6-v2/"

echo "5) build image + run container (host networking → reaches the reverse-tunnel llama on :8080)"
ssh_retry "cd '${REMOTE}/app' && docker build -q -t openalex-backend . && \
  docker rm -f openalex-backend 2>/dev/null; \
  docker run -d --name openalex-backend --restart unless-stopped --network host \
    -e API_PORT=8020 \
    -e LLAMA_BASE_URL=http://localhost:8080 \
    -e EMBEDDINGS_MODEL=/app/models/all-MiniLM-L6-v2 \
    -e DUCKDB_PATH=/app/data/openalex.duckdb \
    -e CHROMA_DIR=/app/data/chroma \
    -e BM25_INDEX_PATH=/app/data/bm25_index.joblib \
    -v '${REMOTE}/data':/app/data \
    -v '${REMOTE}/models':/app/models \
    openalex-backend uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8020"

echo "6) health"; ssh_retry "sleep 8; curl -s http://localhost:8020/health || echo 'not ready yet'"
echo "DONE. Add the nginx /api proxy (docs/deploy/nginx-openalex.conf) and start scripts/tunnel_llama.sh locally."
