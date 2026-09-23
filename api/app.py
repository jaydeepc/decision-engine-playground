"""Decision Engine API: a FastAPI service that wraps the `laya` package.

It is a superset of `laya-serve` (the package's own server) and speaks the same
`POST /v1/systemone` wire protocol as TypeSafe Jev, so any Jev client works by
changing its base URL. Extra routes: `/v1/route` (routing only, no model),
`/v1/presets`, `/v1/models`, and `/health`.

Environment:
  LAYA_API_KEY         if set, clients must send `Authorization: Bearer <key>`
  LAYA_DEVICE          cpu | cuda | mps (auto)
  LAYA_MODELS          comma list to preload at startup (default: english)
  LAYA_PRELOAD         1/0 (default 1)
  LAYA_THREADS         cap torch intra-op threads on CPU
  LAYA_LOCAL_MODEL_DIR a local checkpoint folder to serve as "english"
                       (e.g. models/laya-english downloaded from the GitHub release,
                        or a folder produced by training/finetune.py)
  LAYA_MAX_LOADED      how many checkpoints stay resident (default 2)
  CORS_ORIGINS         comma list, default "*"
"""
from __future__ import annotations

import asyncio
import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

KNOWN = {"english", "multilingual", "typed-decisions"}
API_KEY = os.environ.get("LAYA_API_KEY") or None


def _env_bool(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    return default if v is None else v.strip().lower() in ("1", "true", "yes", "on")


def build_router():
    from laya.router import Router

    if os.environ.get("LAYA_THREADS"):
        import torch
        torch.set_num_threads(int(os.environ["LAYA_THREADS"]))
    device = os.environ.get("LAYA_DEVICE") or None
    models: Dict[str, Any] = {}
    local = os.environ.get("LAYA_LOCAL_MODEL_DIR")
    if local:
        models["english"] = local
    router = Router(models=models or None, device=device, max_loaded=int(os.environ.get("LAYA_MAX_LOADED", "2")))
    if _env_bool("LAYA_PRELOAD", True):
        names = [m.strip() for m in os.environ.get("LAYA_MODELS", "english").split(",") if m.strip()]
        router.preload(names)
    return router


app = FastAPI(title="Decision Engine API", summary="Laya System 1 decisions over the Jev-compatible /v1/systemone protocol", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

_router = None
_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="laya-infer")
_gate: Optional[asyncio.Lock] = None
_started = time.time()


@app.on_event("startup")
def _startup():
    global _router
    _router = build_router()


def _auth(authorization: Optional[str]):
    if API_KEY and authorization != "Bearer " + API_KEY:
        raise HTTPException(status_code=401, detail="invalid or missing bearer token")


def _resolve_model(model: Optional[str]) -> Optional[str]:
    if not model:
        return None
    m = str(model).strip().lower()
    aliases = {"convaiinnovations/laya-multilingual": "multilingual", "convaiinnovations/laya-typed-decisions": "typed-decisions", "en": "english", "ml": "multilingual", "typed": "typed-decisions"}
    m = aliases.get(m, m)
    return m if m in KNOWN else None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "loaded": list(getattr(_router, "loaded", []) or []),
        "device": os.environ.get("LAYA_DEVICE") or "auto",
        "uptime_s": round(time.time() - _started, 1),
    }


@app.get("/v1/models")
def models():
    return {
        "models": [
            {"id": "english", "repo": "convaiinnovations/laya", "encoder": "ModernBERT-large", "params": "421M", "context": 512},
            {"id": "multilingual", "repo": "convaiinnovations/laya/multilingual", "encoder": "mmBERT-base", "params": "322M", "context": 1024},
            {"id": "typed-decisions", "repo": "convaiinnovations/laya/typed-decisions", "encoder": "ModernBERT-large", "params": "421M", "context": 1024},
        ],
        "loaded": list(getattr(_router, "loaded", []) or []),
    }


@app.get("/v1/presets")
def presets():
    import laya

    return {
        "triage": laya.triage_questions(),
        "email": laya.email_questions(),
        "guard": laya.guard_questions(),
        "moderation": laya.moderation_questions(),
        "router": laya.router_questions(),
    }


@app.post("/v1/route")
async def route(request: Request):
    body = await request.json()
    if not isinstance(body, dict) or "state" not in body:
        raise HTTPException(status_code=400, detail="body must be an object with a 'state' field")
    t0 = time.perf_counter()
    d = _router.route(body["state"], body.get("questions") or {})
    return {**dict(d), "latency_ms": round((time.perf_counter() - t0) * 1000, 3)}


@app.post("/v1/systemone")
async def systemone(request: Request, authorization: Optional[str] = Header(default=None)):
    global _gate
    _auth(authorization)
    body = await request.json()
    if not isinstance(body, dict) or "questions" not in body:
        raise HTTPException(status_code=400, detail="request body must be an object with a 'questions' field")
    state = body.get("state")
    questions = body["questions"]
    model = _resolve_model(body.get("model"))
    if _gate is None:
        _gate = asyncio.Lock()
    try:
        async with _gate:
            loop = asyncio.get_running_loop()
            t0 = time.perf_counter()
            res = await loop.run_in_executor(_pool, lambda: _router.predict(state, questions, model=model))
            res["latency_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            return res
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=422, content={"detail": str(e)})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("LAYA_HOST", "0.0.0.0"), port=int(os.environ.get("LAYA_PORT", "8000")))
