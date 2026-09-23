#!/usr/bin/env python3
"""Fine-tune a Laya decision model on your own labelled decisions, on one device.

This is the single-device counterpart of the official Kaggle 2xT4 notebook
(notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb in the laya repository) and uses
the same RLCD recipe: proper-scoring-rule rewards on noisy logit samples (GRPO-style group
advantages) plus a soft cross-entropy anchor, then a post-hoc temperature per question type
fitted on a held-out slice. Runs on CUDA, Apple Silicon (mps) or CPU.

Input: a JSON Lines file. Each row is one state with its questions and gold answers, the
same shape the playground's Model Studio exports and the public typed-decisions benchmark uses:

  {"state": {...}, "questions": {qid: {"type": ..., "instructions": ..., "criteria": ...}},
   "gold": {qid: {"label": ..., "probabilities": {...}}}}

`probabilities` are optional soft targets; if absent, `label` becomes a one-hot target.

Usage:
  python finetune.py --data my.jsonl --base english --out ../models/my-model --epochs 4 --device mps
  python finetune.py --data my.jsonl --base ../models/laya-english --out ../models/my-model --device cpu --epochs 2
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import time
from typing import Any, Dict, List

import torch
from safetensors.torch import load_file, save_file

BASES = {
    "english": ("convaiinnovations/laya", None),
    "multilingual": ("convaiinnovations/laya", "multilingual"),
    "typed-decisions": ("convaiinnovations/laya", "typed-decisions"),
}


def resolve_base(base: str) -> str:
    if os.path.isdir(base):
        return base
    from huggingface_hub import snapshot_download

    repo, sub = BASES[base]
    pats = ["model.safetensors", "rl_agent_config.json", "encoder/*", "tokenizer/*"] if sub is None else [f"{sub}/*"]
    d = snapshot_download(repo, allow_patterns=pats)
    return os.path.join(d, sub) if sub else d


def build_items(rows: List[Dict[str, Any]], tok, cfg: Dict[str, Any]):
    from laya.common import QTYPES, build_sequence, render_options

    items = []
    skipped = 0
    for row in rows:
        state, questions, gold = row["state"], row["questions"], row.get("gold", {})
        for qid, q in questions.items():
            if qid not in gold:
                continue
            g = gold[qid]
            t = q["type"]
            crit = q.get("criteria")
            if t == "choice" and isinstance(crit, list):
                crit = {c: None for c in crit}
            internal = {"t": t, "ins": q["instructions"], "crit": crit}
            if t == "noul" and q.get("labels"):
                internal["labels"] = q["labels"]
            k = len(render_options(internal))
            probs = g.get("probabilities") or {}
            if t == "choice":
                keys = list(crit.keys())
                target = [float(probs.get(kk, 0.0)) for kk in keys] if probs else [1.0 if kk == g.get("label") else 0.0 for kk in keys]
            elif t == "score":
                target = [float(probs.get(str(i), 0.0)) for i in range(k)] if probs else [1.0 if i == int(g.get("label", g.get("score", 0))) else 0.0 for i in range(k)]
            else:
                p_true = float(probs.get("true", g.get("noul", 1.0 if str(g.get("label", "true")).lower() == "true" else 0.0)))
                target = [1.0 - p_true, p_true]
            s = sum(target)
            target = [v / s for v in target] if s > 0 else [1.0 / k] * k
            seq, markers = build_sequence(tok, state, internal, cfg["max_len"], cfg["head_max_len"])
            if len(markers) != k:
                skipped += 1
                continue
            items.append({"ids": seq, "markers": markers, "qtype": QTYPES[t], "target": target, "label": int(max(range(k), key=lambda i: target[i]))})
    return items, skipped


def collate(items, pad_id: int):
    n, L = len(items), max(len(it["ids"]) for it in items)
    kmax = max(len(it["markers"]) for it in items)
    ids = torch.full((n, L), pad_id, dtype=torch.long)
    att = torch.zeros((n, L), dtype=torch.long)
    mpos = torch.zeros((n, kmax), dtype=torch.long)
    mmask = torch.zeros((n, kmax), dtype=torch.bool)
    target = torch.zeros((n, kmax), dtype=torch.float32)
    for i, it in enumerate(items):
        ids[i, : len(it["ids"])] = torch.tensor(it["ids"])
        att[i, : len(it["ids"])] = 1
        k = len(it["markers"])
        mpos[i, :k] = torch.tensor(it["markers"])
        mmask[i, :k] = True
        target[i, :k] = torch.tensor(it["target"])
    return {"input_ids": ids, "attention_mask": att, "marker_pos": mpos, "marker_mask": mmask, "target": target,
            "qtype": torch.tensor([it["qtype"] for it in items]), "label": torch.tensor([it["label"] for it in items])}


def fit_temperature(sel) -> float:
    """One scalar temperature minimising soft cross-entropy on (logits, target) pairs."""
    if len(sel) < 10:
        return 1.0
    kmax = max(len(z) for z, _ in sel)
    Z = torch.full((len(sel), kmax), -1e4)
    T = torch.zeros((len(sel), kmax))
    for i, (z, t) in enumerate(sel):
        Z[i, : len(z)] = torch.tensor(z)
        T[i, : len(t)] = torch.tensor(t)
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)

    def closure():
        opt.zero_grad()
        loss = -(T * torch.log_softmax(Z / log_t.exp(), -1)).sum(-1).mean()
        loss.backward()
        return loss

    opt.step(closure)
    return float(torch.clamp(log_t.exp(), 0.5, 5.0).item())


@torch.no_grad()
def evaluate(model, items, pad_id, device, temps=None, bs=8):
    """Accuracy, mean proper reward and ECE over items; returns per-item logits for calibration."""
    from laya.common import ece_score, proper_reward

    model.eval()
    correct, confs, rewards, logits_out = [], [], [], []
    for i in range(0, len(items), bs):
        chunk = items[i : i + bs]
        b = collate(chunk, pad_id)
        logits, _ = model(b["input_ids"].to(device), b["attention_mask"].to(device), b["marker_pos"].to(device), b["marker_mask"].to(device), b["qtype"].to(device))
        logits = logits.float().cpu()
        mask = b["marker_mask"]
        if temps is not None:
            t = torch.tensor([temps[int(q)] for q in b["qtype"]]).unsqueeze(-1)
            logits = logits / t
        p = torch.softmax(logits.masked_fill(~mask, -1e4), -1)
        r = proper_reward(p.unsqueeze(0), b["target"].unsqueeze(0), b["qtype"], mask)[0]
        for j, it in enumerate(chunk):
            k = len(it["markers"])
            pj = p[j, :k]
            correct.append(float(int(pj.argmax()) == it["label"]))
            confs.append(float(pj.max()))
            rewards.append(float(r[j]))
            logits_out.append((it["qtype"], logits[j, :k].tolist(), it["target"]))
    model.train()
    import numpy as np

    return {
        "n": len(items),
        "accuracy": round(float(np.mean(correct)), 4) if correct else None,
        "mean_reward": round(float(np.mean(rewards)), 4) if rewards else None,
        "ece": round(ece_score(np.array(confs), np.array(correct)), 4) if correct else None,
    }, logits_out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", required=True, help="JSONL of labelled decisions")
    ap.add_argument("--base", default="english", help="english | multilingual | typed-decisions | path to a checkpoint folder")
    ap.add_argument("--out", required=True, help="output checkpoint folder")
    ap.add_argument("--epochs", type=int, default=4)
    ap.add_argument("--device", default=None, help="cuda | mps | cpu (auto)")
    ap.add_argument("--micro-batch", type=int, default=4)
    ap.add_argument("--grad-accum", type=int, default=8)
    ap.add_argument("--group-size", type=int, default=4, help="noisy samples per item for the RL advantage")
    ap.add_argument("--lr-encoder", type=float, default=2.5e-5)
    ap.add_argument("--lr-head", type=float, default=1e-4)
    ap.add_argument("--sigma-start", type=float, default=0.4)
    ap.add_argument("--sigma-end", type=float, default=0.1)
    ap.add_argument("--freeze-encoder", action="store_true", help="train only the decision head (fast, low memory, small data)")
    ap.add_argument("--holdout", type=float, default=0.15, help="fraction held out for calibration and evaluation")
    ap.add_argument("--seed", type=int, default=20260923)
    ap.add_argument("--name", default=None, help="model_name written to the config")
    args = ap.parse_args()

    from transformers import AutoTokenizer
    from laya.agent import _fix_tokenizer_config
    from laya.common import build_model, proper_reward

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    device = torch.device(args.device or ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"))
    base_dir = resolve_base(args.base)
    _fix_tokenizer_config(base_dir)
    with open(os.path.join(base_dir, "rl_agent_config.json")) as f:
        cfg = json.load(f)
    tok = AutoTokenizer.from_pretrained(os.path.join(base_dir, "tokenizer"))

    rows = [json.loads(l) for l in open(args.data, encoding="utf-8") if l.strip()]
    items, skipped = build_items(rows, tok, cfg)
    if not items:
        raise SystemExit("no trainable decisions found in the data")
    random.shuffle(items)
    n_hold = max(1, int(len(items) * args.holdout)) if len(items) >= 8 else 0
    hold, train = items[:n_hold], items[n_hold:]
    print(f"device={device} base={base_dir}\n{len(rows)} rows -> {len(items)} decisions ({skipped} skipped: options did not fit) | train {len(train)} | held-out {len(hold)}")

    model = build_model(cfg, encoder_dir=os.path.join(base_dir, "encoder"))
    model.load_state_dict(load_file(os.path.join(base_dir, "model.safetensors")), strict=True)
    model.to(device).train()
    model.encoder.config.reference_compile = False
    if args.freeze_encoder:
        for p in model.encoder.parameters():
            p.requires_grad_(False)
    elif device.type == "cuda":
        model.encoder.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
        model.head_checkpointing = True

    before, _ = evaluate(model, hold, tok.pad_token_id, device) if hold else ({}, None)
    if hold:
        print("held-out before:", before)

    enc_params = [p for n, p in model.named_parameters() if n.startswith("encoder.") and p.requires_grad]
    head_params = [p for n, p in model.named_parameters() if not n.startswith("encoder.")]
    groups = [{"params": head_params, "lr": args.lr_head}]
    if enc_params:
        groups.append({"params": enc_params, "lr": args.lr_encoder})
    opt = torch.optim.AdamW(groups, weight_decay=0.01)
    steps_per_epoch = max(1, math.ceil(len(train) / (args.micro_batch * args.grad_accum)))
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, steps_per_epoch * args.epochs), eta_min=1e-6)
    use_amp = device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    G = args.group_size
    t0 = time.time()

    for epoch in range(args.epochs):
        random.shuffle(train)
        progress = epoch / max(1, args.epochs - 1)
        sigma = args.sigma_start + (args.sigma_end - args.sigma_start) * progress
        tot, nb, accum = 0.0, 0, 0
        opt.zero_grad(set_to_none=True)
        for b_idx in range(0, len(train), args.micro_batch):
            chunk = train[b_idx : b_idx + args.micro_batch]
            b = collate(chunk, tok.pad_token_id)
            with torch.autocast("cuda", dtype=torch.float16, enabled=use_amp):
                logits, act = model(b["input_ids"].to(device), b["attention_mask"].to(device), b["marker_pos"].to(device), b["marker_mask"].to(device), b["qtype"].to(device))
            logits = logits.float()
            mask = b["marker_mask"].to(device)
            k = mask.sum(-1, keepdim=True).float()
            target = b["target"].to(device)
            # RLCD: sample G zero-mean noisy logit vectors, score each with strictly proper rules,
            # use within-group advantages as the policy-gradient signal.
            eps = torch.randn((G,) + logits.shape, device=device) * sigma * mask
            eps = (eps - eps.sum(-1, keepdim=True) / k) * mask
            z = logits.detach().unsqueeze(0) + eps
            q = torch.softmax(z.masked_fill(~mask, -1e4), -1)
            with torch.no_grad():
                r = proper_reward(q, target.unsqueeze(0), b["qtype"].to(device), mask, w_sph=0.75, w_rps=1.0)
                adv = r - r.mean(0, keepdim=True)
                adv = adv / (adv.std() + 1e-6)
            logp = -(((z - logits.unsqueeze(0)) ** 2) * mask).sum(-1) / (2 * sigma**2)
            loss_rl = -(adv * logp).mean()
            loss_ce = -(target * torch.log_softmax(logits.masked_fill(~mask, -1e4), -1)).sum(-1).mean()
            loss = (loss_rl + loss_ce) / args.grad_accum + 0.0 * act.sum()
            scaler.scale(loss).backward()
            accum += 1
            if accum % args.grad_accum == 0 or b_idx + args.micro_batch >= len(train):
                scaler.unscale_(opt)
                torch.nn.utils.clip_grad_norm_([p for g in groups for p in g["params"]], 1.0)
                scaler.step(opt)
                scaler.update()
                sched.step()
                opt.zero_grad(set_to_none=True)
            tot += loss.item() * args.grad_accum
            nb += 1
            if nb % 20 == 0:
                print(f"  epoch {epoch+1}/{args.epochs} step {nb} loss {loss.item()*args.grad_accum:.4f} reward {r.mean().item():.3f} lr {sched.get_last_lr()[0]:.2e} {time.time()-t0:.0f}s")
        print(f"=== epoch {epoch+1}/{args.epochs} avg loss {tot/max(1,nb):.4f} ({time.time()-t0:.0f}s) ===")

    temps = [float(x) for x in cfg.get("temperature", [1.0, 1.0, 1.0])]
    after = {}
    if hold:
        after_raw, logits_out = evaluate(model, hold, tok.pad_token_id, device)
        for qt in range(3):
            sel = [(z, t) for q_type, z, t in logits_out if q_type == qt]
            if sel:
                temps[qt] = fit_temperature(sel)
        after, _ = evaluate(model, hold, tok.pad_token_id, device, temps=temps)
        print("held-out after (raw):", after_raw)
        print("held-out after (calibrated):", after, "temperatures:", [round(t, 3) for t in temps])

    os.makedirs(args.out, exist_ok=True)
    sd = {k: v.detach().contiguous().cpu() for k, v in model.state_dict().items()}
    save_file(sd, os.path.join(args.out, "model.safetensors"))
    model.encoder.config.save_pretrained(os.path.join(args.out, "encoder"))
    tok.save_pretrained(os.path.join(args.out, "tokenizer"))
    cfg = dict(cfg)
    cfg["fine_tuned"] = True
    cfg["fine_tuned_from"] = args.base
    cfg["model_name"] = args.name or os.path.basename(os.path.abspath(args.out))
    cfg["temperature"] = temps
    cfg.pop("temperature_by_options", None)  # per-type fit would otherwise be masked by inherited buckets
    cfg["training"] = {"data": os.path.basename(args.data), "decisions": len(items), "epochs": args.epochs, "device": str(device), "seconds": round(time.time() - t0), "freeze_encoder": args.freeze_encoder, "held_out_before": before, "held_out_after": after}
    with open(os.path.join(args.out, "rl_agent_config.json"), "w") as f:
        json.dump(cfg, f, indent=2)
    print(f"saved to {args.out}\nserve it: LAYA_LOCAL_MODEL_DIR={os.path.abspath(args.out)} uvicorn app:app --app-dir api")


if __name__ == "__main__":
    main()
