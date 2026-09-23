#!/usr/bin/env bash
# Downloads the English Laya checkpoint attached to this repository's GitHub release into models/laya-english.
set -euo pipefail
cd "$(dirname "$0")"
REPO="jaydeepc/decision-engine-playground"
TAG="${LAYA_RELEASE_TAG:-weights-v1}"
DIR="laya-english"
mkdir -p "$DIR/encoder" "$DIR/tokenizer"
base="https://github.com/$REPO/releases/download/$TAG"
dl() { echo "→ $1"; curl -L --fail --progress-bar -o "$2" "$base/$1"; }
dl model.safetensors "$DIR/model.safetensors"
dl rl_agent_config.json "$DIR/rl_agent_config.json"
dl encoder-config.json "$DIR/encoder/config.json"
dl tokenizer.json "$DIR/tokenizer/tokenizer.json"
dl tokenizer_config.json "$DIR/tokenizer/tokenizer_config.json"
echo "Done: $(du -sh "$DIR" | cut -f1) in models/$DIR"
echo "Verify: python -c 'import laya; print(laya.Agent(\"models/laya-english\").predict({\"body\":\"refund please\"}, laya.triage_questions())[\"answers\"][\"intent\"])'"
