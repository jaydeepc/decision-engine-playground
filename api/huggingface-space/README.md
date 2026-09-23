---
title: Decision Engine API (Laya)
emoji: 🧭
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8000
pinned: false
license: apache-2.0
---

# Decision Engine API on a Hugging Face Space

This Space runs the FastAPI backend from
[jaydeepc/decision-engine-playground](https://github.com/jaydeepc/decision-engine-playground)
and serves Laya over `POST /v1/systemone`.

Setup:

1. Create a **Docker** Space and copy the contents of `api/` into it, plus this README.
2. Add a secret `LAYA_API_KEY`.
3. Optional variables: `LAYA_MODELS=english,multilingual`, `LAYA_DEVICE=cuda` on GPU hardware.
4. Use the Space URL (`https://<user>-<space>.hf.space`) as `LAYA_BACKEND_URL` on Vercel,
   and the same key as `LAYA_BACKEND_KEY`.

The free CPU tier answers a five-question request in roughly one second; a T4 in about 40 ms.
