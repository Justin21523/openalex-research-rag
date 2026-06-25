#!/usr/bin/env bash
# Architecture: backend (FastAPI + data) runs ON the remote dothost server;
# only llama.cpp (the LLM) stays on THIS local machine. This reverse tunnel lets
# the remote backend reach your local llama.cpp at remote-localhost:8080.
#
# Keep this running on your LOCAL machine (where llama.cpp serves on :8080):
#   SSHPASS='NeoJustin007!' bash scripts/tunnel_llama.sh
#
# Then on the SERVER, the backend uses:  LLAMA_BASE_URL=http://localhost:8080
set -uo pipefail
SSH_USER="neojustin"; SSH_HOST="${SSH_HOST:-live.dothost.net}"; SSH_PORT="2965"
: "${SSHPASS:?export SSHPASS first}"; export SSHPASS
echo "Reverse tunnel: remote :8080 -> local llama.cpp :8080  (Ctrl-C to stop)"
while true; do
  sshpass -e ssh -N -p "$SSH_PORT" -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=15 -o ExitOnForwardFailure=yes \
    -R 8080:localhost:8080 "${SSH_USER}@${SSH_HOST}"
  echo "tunnel dropped — reconnecting in 5s…"; sleep 5
done
