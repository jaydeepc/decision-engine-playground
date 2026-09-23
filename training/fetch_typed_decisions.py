#!/usr/bin/env python3
"""Download a slice of the public LocalLLaMA/typed-decisions benchmark as JSONL for finetune.py.

No Hugging Face token needed: uses the public datasets-server API.
  python fetch_typed_decisions.py --workflow customer_service --train 300 --test 100 --out data/
"""
import argparse, json, os

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None
import urllib.request

API = "https://datasets-server.huggingface.co/rows?dataset=LocalLLaMA/typed-decisions&config={cfg}&split={split}&offset={off}&length={n}"


def fetch(cfg, split, n):
    rows, off = [], 0
    while len(rows) < n:
        take = min(100, n - len(rows))
        url = API.format(cfg=cfg, split=split, off=off, n=take)
        if requests is not None:
            d = requests.get(url, timeout=60).json()
        else:
            with urllib.request.urlopen(url, timeout=60) as r:
                d = json.load(r)
        got = [x["row"] for x in d["rows"]]
        if not got:
            break
        rows += got
        off += len(got)
    return rows[:n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workflow", default="customer_service", help="agent_trace_observability | customer_service | invoice_processing | security_incidents | all")
    ap.add_argument("--train", type=int, default=300)
    ap.add_argument("--test", type=int, default=100)
    ap.add_argument("--out", default="data")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for split, n in (("train", a.train), ("test", a.test)):
        rows = fetch(a.workflow, split, n)
        path = os.path.join(a.out, f"typed_decisions_{a.workflow}_{split}.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps({"id": r["id"], "workflow": r["workflow"], "state": json.loads(r["state"]), "questions": json.loads(r["questions"]), "gold": json.loads(r["gold"])}, ensure_ascii=False) + "\n")
        print(f"{len(rows)} rows -> {path}")


if __name__ == "__main__":
    main()
