import Link from "next/link";
import { Section, Eyebrow, H1, H2, Lede } from "@/components/Section";
import CodeBlock from "@/components/CodeBlock";
import exp from "@/data/experiment.json";

export const metadata = { title: "Fine-tune a decision engine · Laya" };

type Metrics = { n?: number; accuracy?: number | null; mean_reward?: number | null; ece?: number | null } | null;
const fmt = (m: Metrics, k: "accuracy" | "ece" | "mean_reward") => (m && m[k] != null ? (m[k] as number).toFixed(3) : "…");

export default function Finetune() {
  const e = exp as {
    status: string; title: string; command: string; setup: string; hardware: string;
    before: Metrics; after: Metrics; test_before: Metrics; test_after: Metrics; minutes: number | null; temperatures: number[] | null; notes: string[];
  };
  return (
    <>
      <Section className="!pb-8">
        <Eyebrow>Fine-tune</Eyebrow>
        <H1>Fine-tuning a decision engine.</H1>
        <Lede>
          Everyone knows what it means to fine-tune a small language model on their own data. Here is the same idea for a decision engine:
          what changes, why it matters more, and how to do it on free or laptop hardware.
        </Lede>
      </Section>

      <Section tone="tint" className="!pt-10">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <img src="/art/finetune.webp" alt="" className="rounded-3xl w-full" width={1600} height={904} />
          <div className="prose">
            <h2 className="!mt-0">The analogy</h2>
            <p>
              Fine-tuning an SLM: take a pretrained decoder, show it thousands of <em>prompt → completion</em> pairs from your domain, nudge the
              weights so its next-token predictions match your completions.
            </p>
            <p>
              Fine-tuning Laya is the same move with two substitutions. The pair becomes <em>(state, question) → probability distribution over
              the options</em>. The objective becomes a reward that is only maximised by honest probabilities, plus a soft cross-entropy anchor.
              Instead of learning how to <em>write</em> answers, the model learns how to <em>weigh</em> options.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="prose max-w-3xl">
          <h2 className="!mt-0">Side by side</h2>
          <table>
            <thead><tr><th></th><th>Small language model</th><th>Decision engine (Laya)</th></tr></thead>
            <tbody>
              <tr><td>Training example</td><td>prompt → completion text</td><td>state + question → distribution over options</td></tr>
              <tr><td>Objective</td><td>next-token cross-entropy</td><td>proper-scoring-rule reward (RLCD) + soft cross-entropy</td></tr>
              <tr><td>What is learned</td><td>how to write answers</td><td>how to weigh options</td></tr>
              <tr><td>Output at inference</td><td>free text you must parse</td><td>fixed-schema numbers</td></tr>
              <tr><td>Typical data</td><td>1k to 100k pairs</td><td>1k to 30k decisions (5 questions per example)</td></tr>
              <tr><td>Compute</td><td>hours to days on A100s for 1B to 8B</td><td>4 to 5 hours on two free T4s for 421M; minutes for head-only</td></tr>
              <tr><td>Failure after tuning</td><td>hallucination, format drift</td><td>over-confidence, fixed by refitting one temperature</td></tr>
            </tbody>
          </table>
          <h2>Why it matters more here</h2>
          <p>
            The Laya benchmarks are blunt. The base checkpoints score 0.36 on the typed-decisions benchmark, where random guessing scores 0.32 and
            always picking the majority class scores 0.46. The fine-tuned checkpoint scores 0.766, above the proprietary Jev model and above the
            LLM teacher's own self-agreement. For an SLM, fine-tuning is often a polish. For a decision engine, it is the product.
          </p>
          <h2>Three levels, cheapest first</h2>
          <ol>
            <li><strong>Schema only.</strong> Write good option descriptions and mention the state field in the instructions. Free. This is what the <Link className="link" href="/playground">playground</Link> presets are.</li>
            <li><strong>Calibration only.</strong> A few hundred labelled decisions, no weight updates. Fit one temperature per question type on held-out data. Upstream this moved calibration error from 0.466 to 0.081, which is what makes a rule like "auto-act above 0.85" mean what it says.</li>
            <li><strong>Full RLCD fine-tune.</strong> Thousands of decisions through the training loop. Produces a new checkpoint folder you can serve or publish.</li>
          </ol>
          <p>There is a cheaper variant of level three: <code>--freeze-encoder</code> trains only the two-layer decision head. A fraction of the memory and time, and a reasonable first pass on small datasets or CPUs.</p>
          <h2>Where labels come from</h2>
          <ul>
            <li><strong>Decisions you already made.</strong> Ticket → queue, email → spam flag, prompt → blocked, invoice → disposition. Usually a SQL export, not a labelling project.</li>
            <li><strong>A teacher LLM.</strong> Ask a frontier model the same typed questions and keep its probabilities as soft targets. The rewards make the student match the teacher's uncertainty, not just its top pick. This is how the typed-decisions benchmark itself was made.</li>
            <li><strong>The Studio.</strong> The model pre-labels, you correct. Corrections are the rows that teach it most. <Link className="link" href="/studio">Open the Studio</Link>.</li>
          </ul>
          <h2>How to do it</h2>
          <CodeBlock lang="bash" code={`git clone https://github.com/jaydeepc/decision-engine-playground && cd decision-engine-playground/training
pip install -r requirements.txt

# a dataset: export from the Studio, or pull a slice of the public benchmark
python fetch_typed_decisions.py --workflow customer_service --train 300 --test 100

# fine-tune on an Apple GPU (mps), an NVIDIA GPU (cuda) or a CPU
python finetune.py --data data/typed_decisions_customer_service_train.jsonl --base english \\
                   --out ../models/customer-service --epochs 3 --device mps

# serve it
LAYA_LOCAL_MODEL_DIR=$PWD/../models/customer-service python ../api/app.py`} />
          <p>
            The script reproduces the official Kaggle recipe on one device: noisy-logit sampling, proper-scoring rewards with group-relative
            advantages, a soft cross-entropy anchor, cosine schedule, two learning rates, then a temperature fit on the held-out slice. It prints
            accuracy, mean reward and expected calibration error before and after. The full write-up of the recipe is in the repository's{" "}
            <a className="link" href="https://github.com/jaydeepc/decision-engine-playground/blob/main/docs/how-laya-is-built.md">docs/how-laya-is-built.md</a>.
          </p>
        </div>
      </Section>

      <Section tone="tint">
        <Eyebrow>Experiment</Eyebrow>
        <H2>{e.title}</H2>
        <Lede>{e.setup}</Lede>
        <div className="mt-8 grid md:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="eyebrow mb-3">Held-out test split · 100 cases · 500 decisions</div>
            <table className="w-full text-[14px]">
              <thead><tr className="text-ink-3 text-[12px]"><th className="text-left font-medium py-1">metric</th><th className="text-right font-medium">base, zero-shot</th><th className="text-right font-medium">after fine-tune</th></tr></thead>
              <tbody>
                <tr className="border-t border-line"><td className="py-2">accuracy (argmax)</td><td className="text-right tabular-nums">{fmt(e.test_before, "accuracy")}</td><td className="text-right tabular-nums font-semibold">{fmt(e.test_after, "accuracy")}</td></tr>
                <tr className="border-t border-line"><td className="py-2">mean proper-score reward, higher is better</td><td className="text-right tabular-nums">{fmt(e.test_before, "mean_reward")}</td><td className="text-right tabular-nums font-semibold">{fmt(e.test_after, "mean_reward")}</td></tr>
                <tr className="border-t border-line"><td className="py-2">expected calibration error, lower is better</td><td className="text-right tabular-nums">{fmt(e.test_before, "ece")}</td><td className="text-right tabular-nums font-semibold">{fmt(e.test_after, "ece")}</td></tr>
              </tbody>
            </table>
            <div className="text-[12px] text-ink-3 mt-3">{e.hardware}{e.minutes ? ` · ${e.minutes} minutes wall clock` : ""}{e.status === "running" ? " · run in progress, numbers land here when it finishes" : ""}</div>
          </div>
          <div className="card p-5">
            <div className="eyebrow mb-3">Reference points from the upstream benchmark</div>
            <table className="w-full text-[14px]">
              <tbody>
                <tr><td className="py-2">random guess</td><td className="text-right tabular-nums">0.318</td></tr>
                <tr className="border-t border-line"><td className="py-2">per-question majority class</td><td className="text-right tabular-nums">0.461</td></tr>
                <tr className="border-t border-line"><td className="py-2">base <code className="mono">laya</code>, zero-shot, all workflows</td><td className="text-right tabular-nums">0.362</td></tr>
                <tr className="border-t border-line"><td className="py-2">TypeSafe Jev 1.13.0 (published)</td><td className="text-right tabular-nums">0.727</td></tr>
                <tr className="border-t border-line"><td className="py-2"><code className="mono">laya-typed-decisions</code>, 4 epochs, 6,000 decisions, 2×T4</td><td className="text-right tabular-nums">0.766</td></tr>
                <tr className="border-t border-line"><td className="py-2">teacher self-agreement ceiling</td><td className="text-right tabular-nums">0.735</td></tr>
              </tbody>
            </table>
            <div className="text-[12px] text-ink-3 mt-3">Our run uses a quarter of the training data, one workflow, three epochs and a laptop GPU, so it is a floor for what the recipe does, not a ceiling.</div>
          </div>
        </div>
        {e.notes.length > 0 && (
          <div className="prose mt-8 max-w-3xl">
            <h3>What we learned</h3>
            <ul>{e.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
        <CodeBlock lang="bash" code={e.command} title="The exact command" />
      </Section>

      <Section>
        <Eyebrow>Next</Eyebrow>
        <div className="flex flex-wrap gap-3 mt-2">
          <Link href="/studio" className="btn btn-primary">Design a model in the Studio</Link>
          <a href="https://github.com/NandhaKishorM/laya/blob/main/notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb" className="btn btn-secondary">Kaggle 2×T4 notebook ↗</a>
          <a href="https://github.com/jaydeepc/decision-engine-playground/tree/main/training" className="btn btn-secondary">training/ on GitHub ↗</a>
        </div>
      </Section>
    </>
  );
}
