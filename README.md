<p align="center">
  <img src="web/public/brand/laya-mark.svg" width="56" alt="" /><br/>
  <b>Decision Engine Playground</b><br/>
  An information site, chat-style playground, hosted API and model studio for
  <a href="https://github.com/NandhaKishorM/laya">Laya</a>, the open-source 33 ms System 1 decision engine.
</p>

---

**What is in here**

| folder | what |
|---|---|
| `web/` | Next.js 15 site on Vercel: Learn, Playground (chat), API docs with a live console, Model Studio, Fine-tune guide, Download. Also the API gateway (`/api/v1/systemone`, `/api/v1/route`), passcode gate and API-key auth. |
| `api/` | Python FastAPI **model backend** wrapping `laya`. Jev-compatible `POST /v1/systemone`. Dockerfile and Hugging Face Space recipe included. |
| `training/` | `finetune.py`: single-device (CUDA / Apple `mps` / CPU) RLCD fine-tuning from a JSONL of labelled decisions. `fetch_typed_decisions.py` pulls slices of the public benchmark. |
| `models/` | `download.sh` fetches the English checkpoint (843 MB) from this repo's GitHub release. Fine-tuned models land here. |
| `docs/` | The written study: how Laya is built, what "your own model" means, and what fine-tuning a decision engine means compared with an SLM. |

**Architecture**

```
browser ──► Vercel (Next.js UI + gateway: auth, validation, routing, presets)
                │  LAYA_BACKEND_URL + LAYA_BACKEND_KEY
                ▼
        api/app.py (FastAPI + laya + torch)  ← runs anywhere with 4 GB RAM; GPU optional
                │
        checkpoints: english (local or HF) · multilingual (HF) · typed-decisions (HF)
```

Vercel functions cannot hold a 421M-parameter PyTorch model, so the model runs on a separate host and the
gateway forwards to it. Routing (`/api/v1/route`), schema validation and auth run on Vercel itself.

## Run it locally

```bash
# 1. model backend (downloads the English checkpoint from Hugging Face on first start)
cd api && python3 -m venv ../.venv && ../.venv/bin/pip install -r requirements.txt
LAYA_API_KEY=local-dev-key LAYA_DEVICE=mps ../.venv/bin/python app.py      # :8000

# 2. web
cd ../web && npm install
cat > .env.local <<EOT
LAYA_BACKEND_URL=http://localhost:8000
LAYA_BACKEND_KEY=local-dev-key
PLAYGROUND_PASSCODE=choose-a-code
API_KEYS=choose-an-api-key
SESSION_SECRET=choose-a-long-random-string
EOT
npm run dev                                                                # :3000
```

`./scripts/serve-local.sh --tunnel` starts the backend and exposes it with ngrok, which is the quickest
way to give a Vercel deployment a backend from a laptop.

## Deploy

1. **Backend**: any host. Options in [`api/README.md`](api/README.md): bare Python, Docker, or a Hugging Face
   Docker Space (free CPU tier works; a T4 gives ~40 ms).
2. **Web**: `vercel --cwd web` (or import the repo in Vercel with root directory `web`). Environment variables:

| variable | purpose |
|---|---|
| `LAYA_BACKEND_URL` | the backend's base URL |
| `LAYA_BACKEND_KEY` | its `LAYA_API_KEY` |
| `PLAYGROUND_PASSCODE` | access code for the Playground and Studio |
| `API_KEYS` | comma-separated bearer keys for `/api/v1/systemone` |
| `SESSION_SECRET` | signs the session cookie |

## Use the API

```bash
curl -s https://<your-deployment>/api/v1/systemone \
  -H "Authorization: Bearer $KEY" -H "content-type: application/json" \
  -d '{"state":{"body":"Billed twice. Refund today or we cancel."},
       "questions":{"queue":{"type":"choice","instructions":"Which team owns this?",
                             "criteria":{"billing":"refunds","tech":"bugs","other":"else"}},
                    "churn":{"type":"noul","instructions":"Does the customer threaten to cancel?"}}}'
```

Full docs, examples and a browser console live at `/build` on the deployed site.

## Fine-tune your own decision model

```bash
cd training && pip install -r requirements.txt
python fetch_typed_decisions.py --workflow customer_service --train 300 --test 100   # or export from the Studio
python finetune.py --data data/typed_decisions_customer_service_train.jsonl --base english \
                   --out ../models/customer-service --epochs 3 --device mps
LAYA_LOCAL_MODEL_DIR=$PWD/../models/customer-service python ../api/app.py
```

See [`docs/`](docs/) and the site's Fine-tune page for what the recipe does and what to expect.

## Credits and license

Laya, its weights, presets and the RLCD recipe are by Nandakishor Mukkunnoth / ConvAI Innovations, Apache 2.0.
This playground is an independent community project, also Apache 2.0. Artwork generated with GPT Image 2.5 via Higgsfield.
