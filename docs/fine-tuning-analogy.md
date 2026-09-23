# Fine-tuning a decision engine, explained by analogy with fine-tuning an SLM

## The analogy

When a team says "we fine-tuned a small language model on our data", they mean: we took a pretrained decoder, showed it thousands of
(prompt → completion) pairs from our domain, and nudged the weights so its next-token predictions match our completions. The model
keeps its general language ability and gains our style, vocabulary and task.

Fine-tuning Laya is the same move with two substitutions:

| | SLM | decision engine (Laya) |
|---|---|---|
| training example | prompt → completion text | (state, question) → probability distribution over the options |
| objective | next-token cross-entropy | proper-scoring-rule reward (RLCD) + soft cross-entropy |
| what is learned | how to *write* answers | how to *weigh* options |
| output at inference | free text you must parse | fixed-schema numbers |
| typical data size | 1k to 100k pairs | 1k to 30k decisions (5 questions per example ⇒ 200 to 6,000 examples) |
| compute | hours to days on A100s for 1B to 8B models | 4 to 5 hours on two free T4s for 421M; minutes for head-only |
| failure mode after tuning | hallucination, format drift | over-confidence, which temperature refitting repairs |

## Why it matters more for a decision engine than for an SLM

The Laya benchmarks are blunt: the base checkpoints score 0.36 on the typed-decisions benchmark (random is 0.32, majority class 0.46)
and the fine-tuned checkpoint scores 0.766, above the proprietary Jev model and above the LLM teacher's own self-agreement. Zero-shot
Laya is a fast base that understands option descriptions; fine-tuning is where the accuracy lives. For an SLM, fine-tuning is often
a polish. For a decision engine, it is the product.

## Three levels, cheapest first

1. **Schema only (zero-shot).** Write good option descriptions and mention the state field in the instructions. Free. Try it in the
   playground.
2. **Calibration only.** A few hundred labelled decisions, no weight updates. Fit one temperature per question type on held-out data.
   Upstream: ECE 0.466 → 0.081. This makes thresholds like "auto-act above 0.85" mean what they say.
3. **Full RLCD fine-tune.** Thousands of decisions, the loop in `training/finetune.py` or the Kaggle notebook. Produces a new
   checkpoint folder you can serve with `LAYA_LOCAL_MODEL_DIR` or push to Hugging Face.

There is also a fourth, cheaper, level that `finetune.py --freeze-encoder` exposes: train only the 2-layer decision head. It uses a
fraction of the memory and time, and is a reasonable first pass on small datasets or CPUs.

## Where the labels come from

* **Historic decisions you already made**: ticket → queue, email → spam flag, prompt → blocked, invoice → disposition. Usually a SQL export.
* **A teacher LLM**: ask a frontier model the same typed questions, keep its probabilities as soft targets. The proper-scoring rewards
  make the student match the teacher's uncertainty, not just its argmax. This is how the typed-decisions benchmark was built.
* **The playground's Studio**: the model pre-labels, you correct. Corrections are the highest-value rows.

## How to do it (Apple Silicon, one command)

```bash
cd training
python fetch_typed_decisions.py --workflow customer_service --train 300 --test 100
python finetune.py --data data/typed_decisions_customer_service_train.jsonl --base english \
                   --out ../models/customer-service --epochs 3 --device mps
```

The script prints held-out accuracy, mean reward and expected calibration error before and after, fits temperatures, and writes a
checkpoint folder that `api/app.py` can serve. The experiment we ran with exactly this command is reported on the site's Fine-tune page.

## Result of that exact run (2026-09-23)

Apple M3 Max, `mps`, 300 customer-service cases (1,350 training decisions, 150 held out for calibration), 3 epochs, 54 minutes.
Evaluated on the separate 100-case test split (500 decisions):

| | base, zero-shot | fine-tuned |
|---|---|---|
| accuracy | 0.376 | **0.712** |
| mean proper-score reward | −1.124 | **−0.590** |
| ECE | 0.121 | 0.118 |
| choice / score / noul accuracy | 0.26 / 0.36 / 0.65 | 0.71 / 0.71 / 0.73 |

Reference: the upstream `laya-typed-decisions` checkpoint, trained on all four workflows (6,000 decisions) on 2×T4, scores 0.766.
