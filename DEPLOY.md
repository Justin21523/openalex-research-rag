# Deployment Guide

Target architecture (chosen): **frontend + FastAPI API run on the remote server**, and the
**llama.cpp LLM runs on your local machine**. The remote API reaches back to your local
llama.cpp through a reverse SSH tunnel. If the LLM is unreachable, RAG automatically falls
back to extractive answers, so the app keeps working.

```
[ Browser ] --HTTPS--> [ Remote: static frontend + FastAPI API (:8020) ]
                                   |  LLAMA_BASE_URL=http://localhost:8080
                                   v  (reverse SSH tunnel)
                         [ Your machine: llama.cpp (:8080) ]
```

## Quick deploy (scripts) — run from a network that can reach SSH port 2965

```bash
export SSHPASS='<server-password>'

# 1) Frontend → /public_html/projects/openalex-research-rag/ (small files, auto-retry)
bash scripts/deploy_dothost.sh

# 2) Full backend as a Docker container on the server (resumable ~2GB data rsync)
bash scripts/deploy_backend.sh

# 3) On the server: add the nginx /api proxy
#    (docs/deploy/nginx-openalex.conf) → nginx -t && reload

# 4) On THIS local machine: keep the reverse tunnel up so the server's backend
#    reaches your local llama.cpp:
bash scripts/tunnel_llama.sh
```

Note: the server (`live.dothost.net:2965`) is intermittently reachable; all scripts
retry on drops, and the backend data transfer uses `rsync --partial --append-verify`
so it resumes where it left off.

---

## 1. Frontend (static build)

The API address is resolved at runtime from `public/config.js` (no rebuild needed to change it),
then build-time `VITE_API_URL`, then `http://localhost:8020`.

Build:
```bash
cd frontend
npm install
npm run build          # outputs frontend/dist/
```

Deploy `frontend/dist/` to the remote web root. Then edit the deployed **`dist/config.js`** to point
at the remote API origin (same server, public URL):
```js
window.__APP_CONFIG__ = { apiUrl: "https://your-domain.com/api" };
// or: { apiUrl: "http://<remote-ip>:8020" };
```
(Changing `config.js` does NOT require rebuilding the bundle.)

Serve `dist/` with nginx/Apache/any static host. If the API is on the same host, reverse-proxy
`/api` → `http://localhost:8020` so the frontend and API share an origin.

---

## 2. API (remote server)

The API needs the data files (`data/openalex.duckdb`, `data/chroma/`, `data/bm25_index.joblib`)
and the embedding model cache. Configure via environment (or a `.env` at project root):

```bash
export API_HOST=0.0.0.0
export API_PORT=8020
export LLAMA_BASE_URL=http://localhost:8080      # reached via the tunnel below
export CORS_ORIGINS="https://your-domain.com"     # or "*" (default) to allow any origin
# optional: DUCKDB_PATH / CHROMA_DIR / BM25_INDEX_PATH if data lives elsewhere

uvicorn src.api.main:app --host 0.0.0.0 --port 8020
```

Notes:
- `CORS_ORIGINS` is comma-separated; default `*` already allows any frontend origin.
- The app contains a HuggingFace cache-lock guard (`src/api/main.py`) that is a no-op on a
  normally-writable host.

---

## 3. Connect the remote API to your LOCAL llama.cpp

Start llama.cpp locally (OpenAI-compatible server on :8080), e.g.:
```bash
llama-server -m model.gguf --port 8080
```

Open a **reverse SSH tunnel from your local machine** so the remote `localhost:8080` maps to
your local llama:
```bash
ssh -N -R 8080:localhost:8080 neojustin@live.dothost.net
```
With this running, the remote API's `LLAMA_BASE_URL=http://localhost:8080` reaches your local LLM.

Alternatives:
- Expose llama publicly with a tunnel and point the API at it:
  `ngrok http 8080` (or `cloudflared`) → set `LLAMA_BASE_URL=https://<tunnel-url>`.
- VPN / private network → `LLAMA_BASE_URL=http://<your-lan-ip>:8080`.

If the tunnel is down, `/rag/answer` still works in **extractive** mode (no LLM needed).

---

## 4. Verify
```bash
curl https://your-domain.com/api/health          # works_count, llm_available
# open the site → RAG Q&A: with the tunnel up you get LLM answers; without it, extractive.
```

## 5. Growing the corpus (optional, offline)
```bash
# fetch more papers (polite-pool email required), then rebuild indexes, then restart the API
curl -X POST "http://localhost:8020/admin/ingest/openalex?email=you@example.com&limit_per_topic=12000"
python src/features/build_index.py    # BM25 + embeddings + FTS (minutes)
# restart API, then: python scripts/warmup_demo.py --base-url http://localhost:8020
```
