#!/usr/bin/env bash
# Deploy the built frontend to the dothost portfolio server in SMALL BATCHES with
# RETRIES (the server drops connections easily). Run from a network that can reach
# SSH port 2965 (this server appears IP-restricted — run from your usual machine).
#
#   SSHPASS='NeoJustin007!' bash scripts/deploy_dothost.sh
#
set -uo pipefail

SSH_USER="neojustin"
SSH_HOST="${SSH_HOST:-live.dothost.net}"     # SSH host (web host is neojustin.dothost.net)
SSH_PORT="2965"
REMOTE_DIR="/home/${SSH_USER}/public_html/projects/openalex-research-rag"
DIST="$(cd "$(dirname "$0")/.." && pwd)/frontend/dist"
: "${SSHPASS:?export SSHPASS='<password>' first}"
export SSHPASS

SSHO=(-p "$SSH_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=20 -o ServerAliveInterval=10)

run_ssh() { sshpass -e ssh "${SSHO[@]}" "${SSH_USER}@${SSH_HOST}" "$@"; }

# scp one file, retrying forever until it succeeds (server is flaky)
put() {
  local src="$1" dst="$2" n=0
  until sshpass -e scp "${SSHO[@]}" "$src" "${SSH_USER}@${SSH_HOST}:${dst}"; do
    n=$((n+1)); echo "  retry $n: $src"; sleep 5
  done
  echo "  ok: $(basename "$src")"
}

echo "1) ensure remote dir"
until run_ssh "mkdir -p '${REMOTE_DIR}/assets'"; do echo "  retry mkdir"; sleep 5; done

echo "2) upload top-level files (index.html, config.js, etc.) one by one"
find "$DIST" -maxdepth 1 -type f | while read -r f; do put "$f" "${REMOTE_DIR}/$(basename "$f")"; done

echo "3) upload assets/ one by one"
find "$DIST/assets" -type f | while read -r f; do put "$f" "${REMOTE_DIR}/assets/$(basename "$f")"; done

echo "DONE. Frontend at: https://neojustin.dothost.net/projects/openalex-research-rag/"
echo "Next: add the nginx /api proxy (docs/deploy/nginx-openalex.conf) + start the backend + reverse tunnel."
