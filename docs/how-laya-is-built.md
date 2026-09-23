# How a Laya decision engine is built

A study of the public code and checkpoints (laya 0.3.9, `convaiinnovations/laya` on Hugging Face), written for the
Decision Engine Playground. Everything here is verifiable in `laya/common.py`, `laya/agent.py`, the checkpoint's
`rl_agent_config.json`, and the Kaggle fine-tuning notebook in the upstream repository.

## 1. The three parts of a checkpoint

| file | what it is |
|---|---|
| `encoder/config.json` | the architecture of the pretrained bidirectional encoder (ModernBERT-large: 28 layers, hidden 1024, 16 heads, alternating global/sliding attention, RoPE, 8,192 max positions) |
| `model.safetensors` | the encoder weights **and** the decision head weights in one state dict (843 MB fp32 for 421M parameters) |
| `rl_agent_config.json` | `head_layers: 2`, `max_len: 512`, `head_max_len: 192`, the per-type temperatures and per-option-count temperature buckets, and a note of how long training ran |
| `tokenizer/` | the encoder's tokenizer (50k BPE for English; a 256k Gemma-derived vocabulary for the multilingual mmBERT checkpoint) |

There is no prompt template, no LoRA adapter, no answer vocabulary. Questions are supplied at inference time as text.

## 2. The sequence format

Each question becomes one sequence. `build_sequence` in `laya/common.py` lays it out as:

```
[CLS] <type> question: <instructions> [SEP] [MASK] opt0 [MASK] opt1 ... [SEP] <state as JSON> [SEP]
```

* Options are rendered as `key: description` for `choice`, `level i: text` for `score`, and `false: …` / `true: …` for `noul`.
* Every option is preceded by a `[MASK]` token. Its position is recorded as a *marker*.
* The head (type + instructions + options) gets at most `head_max_len` tokens (192 for English, 256 for the 1,024-token checkpoints);
  each option text is capped at 48 tokens and shrunk evenly if the budget is exceeded. This is the mechanism behind the
  "keep choice under about 20 options" advice: at 77 options each gets 3 to 4 tokens.
* The state, serialised as compact JSON, gets whatever is left of `max_len`. Long states are truncated from the right by default
  (or the left for conversations, so the latest turn survives).

## 3. The model

`DecisionModel` in `laya/common.py`:

1. **Encoder**: ModernBERT-large or mmBERT-base, run with SDPA attention, producing a hidden vector per token.
2. **Type embedding**: an `nn.Embedding(3, d)` for choice / score / noul is added to every position.
3. **Decision head**: a 2-layer `nn.TransformerEncoder` (pre-norm, 4×d feed-forward, `d/64` heads) over the whole sequence.
4. **Scorer**: `LayerNorm → Linear(d,d) → GELU → Linear(d,1)` applied at each marker position → one logit per option.
5. **Softmax over the markers** = the answer distribution. Padding markers are masked to −1e4.
6. **Action head**: a small MLP on the `[CLS]` vector plus four summary features (top-1 probability, top-1 minus top-2,
   normalised entropy, option count) predicting whether to act or escalate. The README reports this head carries no usable
   signal yet (#185); gate on `confidence` instead.

The head is trained from scratch; the encoder is fine-tuned end to end.

## 4. Turning logits into answers (`Agent.system_one`)

* Logits are divided by a **temperature**: the per-(type, option-count) bucket if present, else the per-type value. At load time
  values outside [0.5, 5] are clamped and reported (the shipped `choice:11+ = 0.10` bucket is one such case).
* `choice` returns the argmax key, all probabilities and `confidence = 1 − H(p)/log k`.
* `score` returns the expectation `Σ i·p_i`, the legend, the distribution and confidence.
* `noul` returns `p[1]`, the probability of the `true` slot.
* `usage.input_tokens` is the number of non-padding tokens; `output_tokens` is always 0.

All questions for one state are batched into a single forward pass (`collate_items`), which is why 10 questions cost 7.2 ms each
on a T4 instead of 33 ms.

## 5. Training: RLCD

From `train_ddp.py` in the Kaggle notebook:

```
for each micro-batch:
    logits, act = model(...)                        # one logit per option
    eps ~ N(0, sigma²), projected to zero mean over the options
    z_g = logits.detach() + eps_g   for g in 1..G   # G = 4 noisy "policies"
    q_g = softmax(z_g)
    r_g = proper_reward(q_g, target)                # log score + 0.75·spherical (+ ranked probability score for ordinal)
    adv_g = (r_g − mean_g r) / std                  # GRPO-style group-relative advantage
    logp_g = −‖z_g − logits‖² / (2σ²)               # log-density of the sample under the current policy
    loss = −mean(adv·logp) + soft_cross_entropy(logits, target)
```

* **Strictly proper scoring rules** as reward: log score, spherical score, and for `score` questions the ranked probability score
  (which penalises being off by two levels more than by one). Strictly proper means the expected reward is maximised only by
  reporting your true belief, which is what makes the probabilities calibrated by construction rather than by post-hoc trickery.
* **Soft targets**: the benchmark's gold answers are probability distributions from an LLM teacher, not just labels. The reward and the
  cross-entropy both accept soft targets, so the student learns the teacher's uncertainty.
* **Exploration noise** `sigma` anneals from 0.4 to 0.1 over training; two learning rates (encoder 2.5e-5, head 1e-4); AdamW, cosine
  schedule, fp16 autocast on T4, gradient checkpointing on both encoder and head.
* **Post-hoc calibration**: after training, one temperature per question type is fitted by L-BFGS on a held-out slice, and inherited
  per-bucket temperatures are removed from the config so the new fit is not masked.
* **TD(λ) targets** exist in the code for multi-turn conversation episodes (the lineage of the 2025 sales-conversion model), but the
  public notebook trains on single-shot decisions.

Compute: 4 epochs over ~30k questions in 4 to 5 hours on 2×T4. The single-device script in this repository, `training/finetune.py`,
reproduces the same loop on one GPU, an Apple GPU or a CPU.

## 6. Routing

`laya/lang.py` classifies the Unicode script of the letters in the state (22 ranges) and, for Latin text, counts function words in
nine languages plus the rate of non-English diacritics. `Router.route` turns that into english vs multilingual with a reason string.
It never touches torch, which is why this playground can run the same logic in TypeScript on Vercel (`web/src/lib/lang.ts`, ported
from the upstream `laya-ts` package).

## 7. What this means for "creating your own model"

Because the questions are inputs and the head is generic, a new decision model is:

1. a question schema (JSON), which alone gives a zero-shot *schema model* on the base checkpoint;
2. plus a few hundred labelled decisions to refit temperatures (a *calibrated schema model*);
3. plus thousands of labelled or teacher-distilled decisions and the RLCD loop (a *fine-tuned model*).

Steps 1 and 2 need no GPU. Step 3 needs a few GPU hours. The playground's Model Studio does 1 and prepares the data for 2 and 3.
