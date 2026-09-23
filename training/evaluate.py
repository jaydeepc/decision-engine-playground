#!/usr/bin/env python3
"""Evaluate a checkpoint on a JSONL of labelled decisions (same format as finetune.py).

  python evaluate.py --model ../models/laya-english --data data/typed_decisions_customer_service_test.jsonl --device mps
"""
import argparse, json, os
import torch
from safetensors.torch import load_file


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--data", required=True)
    ap.add_argument("--device", default=None)
    ap.add_argument("--out", default=None, help="write metrics JSON here")
    a = ap.parse_args()
    from transformers import AutoTokenizer
    from laya.agent import _fix_tokenizer_config
    from laya.common import build_model
    from finetune import build_items, evaluate

    device = torch.device(a.device or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"))
    _fix_tokenizer_config(a.model)
    cfg = json.load(open(os.path.join(a.model, "rl_agent_config.json")))
    tok = AutoTokenizer.from_pretrained(os.path.join(a.model, "tokenizer"))
    rows = [json.loads(l) for l in open(a.data, encoding="utf-8") if l.strip()]
    items, skipped = build_items(rows, tok, cfg)
    model = build_model(cfg, encoder_dir=os.path.join(a.model, "encoder"))
    model.load_state_dict(load_file(os.path.join(a.model, "model.safetensors")), strict=True)
    model.to(device).eval()
    model.encoder.config.reference_compile = False
    temps = cfg.get("temperature")
    temps = [float(t) for t in temps] if temps else None
    raw, _ = evaluate(model, items, tok.pad_token_id, device)
    cal, _ = evaluate(model, items, tok.pad_token_id, device, temps=temps) if temps else (raw, None)
    by_type = {}
    for qt, name in ((0, "choice"), (1, "score"), (2, "noul")):
        sel = [it for it in items if it["qtype"] == qt]
        if sel:
            by_type[name], _ = evaluate(model, sel, tok.pad_token_id, device, temps=temps)
    out = {"model": a.model, "data": a.data, "decisions": len(items), "skipped": skipped, "raw": raw, "calibrated": cal, "by_type": by_type, "temperatures": temps}
    print(json.dumps(out, indent=2))
    if a.out:
        json.dump(out, open(a.out, "w"), indent=2)


if __name__ == "__main__":
    main()
