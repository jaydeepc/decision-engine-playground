# Decision Engine API (Python backend)

FastAPI service wrapping the [`laya`](https://pypi.org/project/laya/) package. Jev-compatible
`POST /v1/systemone`, plus `/v1/route`, `/v1/presets`, `/v1/models`, `/health`.

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
LAYA_API_KEY=change-me LAYA_MODELS=english LAYA_DEVICE=mps .venv/bin/python app.py
curl -s localhost:8000/v1/systemone -H 'Authorization: Bearer change-me' -H 'content-type: application/json' \
  -d '{"state":{"body":"billed twice, refund please"},"questions":{"dept":{"type":"choice","instructions":"which team?","criteria":{"billing":"refunds","tech":"bugs"}}}}'
```

Serve a local checkpoint (the GitHub release weights or a fine-tuned folder) as `english`:

```bash
LAYA_LOCAL_MODEL_DIR=../models/laya-english .venv/bin/python app.py
```

See `Dockerfile` and `huggingface-space/README.md` for hosted options.
