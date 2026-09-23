#!/usr/bin/env bash
# Run the model backend on this machine and (optionally) expose it with ngrok so the Vercel gateway can reach it.
#   ./scripts/serve-local.sh            # backend only, http://localhost:8000
#   ./scripts/serve-local.sh --tunnel   # backend + public https URL via ngrok
set -euo pipefail
cd "$(dirname "$0")/.."
export LAYA_API_KEY="${LAYA_API_KEY:-change-me}"
export LAYA_DEVICE="${LAYA_DEVICE:-$( [ "$(uname -s)" = Darwin ] && echo mps || echo cpu )}"
export LAYA_MODELS="${LAYA_MODELS:-english}"
if [ -d models/laya-english ] && [ -z "${LAYA_LOCAL_MODEL_DIR:-}" ]; then export LAYA_LOCAL_MODEL_DIR="$PWD/models/laya-english"; fi
[ -x .venv/bin/python ] || { python3 -m venv .venv && .venv/bin/pip install -r api/requirements.txt; }
echo "device=$LAYA_DEVICE models=$LAYA_MODELS local=${LAYA_LOCAL_MODEL_DIR:-<hf hub>}"
.venv/bin/uvicorn app:app --app-dir api --host 0.0.0.0 --port "${LAYA_PORT:-8000}" &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
if [ "${1:-}" = "--tunnel" ]; then
  command -v ngrok >/dev/null || { echo "install ngrok (brew install ngrok) and run: ngrok config add-authtoken <token>"; exit 1; }
  ngrok http "${LAYA_PORT:-8000}" --log=stdout --log-format=logfmt | grep --line-buffered -o 'url=https://[^ ]*' &
fi
wait $PID
