import Studio from "./Studio";
import { Section, Eyebrow, H1, Lede } from "@/components/Section";
import Link from "next/link";

export const metadata = { title: "Model Studio · Design your own decision model" };

export default function Page() {
  return (
    <>
      <Section className="!pb-6">
        <Eyebrow>Model Studio</Eyebrow>
        <H1>Design your own decision model.</H1>
        <Lede>
          A decision model is a base encoder plus <em>your</em> questions plus <em>your</em> labelled examples. Design the questions here, test them
          against the live model, label examples with the model's help, and export a training-ready dataset and recipe. The heavy lifting, a few
          GPU hours, runs from the exported files. <Link className="link" href="#study">Read the study</Link> on what is and is not possible in a browser.
        </Lede>
      </Section>
      <Studio />
      <StudyNotes />
    </>
  );
}

function StudyNotes() {
  return (
    <Section id="study" tone="tint">
      <Eyebrow>Study</Eyebrow>
      <h2 className="title text-3xl sm:text-5xl">Can people create their own decision engine from a web page?</h2>
      <div className="prose mt-8 max-w-3xl">
        <h3>What a Laya model actually is</h3>
        <p>
          Reading the training code and the checkpoints tells you that a Laya model has exactly three parts: a pretrained bidirectional encoder
          (ModernBERT-large or mmBERT-base), a small decision head trained from scratch, and a config file with a handful of numbers, mostly
          calibration temperatures. There is no prompt, no LoRA adapter and no vocabulary of answers baked in. The <em>questions</em> arrive at inference
          time as text. That has a big consequence: <strong>designing a model is designing a question schema and a dataset</strong>, not writing code.
        </p>
        <h3>So which parts can live in the UI?</h3>
        <table>
          <thead><tr><th>Step</th><th>In the browser?</th><th>Why</th></tr></thead>
          <tbody>
            <tr><td>Design the schema (question ids, types, options, rubric levels)</td><td><strong>Yes, fully</strong></td><td>It is JSON. The Studio validates it against the same rules as the API and warns about the known pitfalls: more than 20 options, boolean-looking choice keys, missing descriptions.</td></tr>
            <tr><td>Test the schema zero-shot</td><td><strong>Yes</strong></td><td>Every edit can be sent to the hosted model immediately. This is where you discover which questions the base model already answers well and which need data.</td></tr>
            <tr><td>Collect and label examples</td><td><strong>Yes, with help</strong></td><td>The model pre-labels each example; you confirm or correct. Corrections are the highest-value training signal because they are exactly where the base model is wrong. The RLCD recipe accepts soft targets, so you can even keep the model's probabilities where you agree.</td></tr>
            <tr><td>Train the encoder and head</td><td><strong>No</strong></td><td>Fine-tuning 421M parameters needs about 4 GPU-hours on two T4s for 30k questions, and gigabytes of activations. Browsers cannot do that, and Vercel functions cannot either. The Studio instead exports a dataset, a config and a one-command recipe that runs on Kaggle, Colab, a laptop with an Apple GPU, or any CUDA box.</td></tr>
            <tr><td>Calibrate</td><td><strong>Partly</strong></td><td>Fitting a temperature is a one-parameter optimisation over logits. It could run in the browser given exported logits; today the training script does it on the held-out slice.</td></tr>
            <tr><td>Publish and serve</td><td><strong>Yes</strong></td><td>The output is an ordinary checkpoint folder. Point the backend's <code>LAYA_LOCAL_MODEL_DIR</code> at it, or push it to Hugging Face and load it by name.</td></tr>
          </tbody>
        </table>
        <h3>Three levels of "your own model"</h3>
        <ol>
          <li><strong>A schema model.</strong> Just your questions on the base checkpoint. Zero training. Good enough for many routing and guardrail tasks, and what the playground presets are.</li>
          <li><strong>A calibrated schema model.</strong> Your questions, a few hundred labelled examples, and a refitted temperature per question type. No weight updates. Turns over-confident probabilities into ones you can threshold on. Cheap and often the biggest practical win.</li>
          <li><strong>A fine-tuned model.</strong> Your questions, one to ten thousand labelled decisions, and the RLCD training run. This is what took the typed-decisions benchmark from near-random to 0.766. See <Link className="link" href="/finetune">Fine-tune</Link>.</li>
        </ol>
        <h3>Where data comes from</h3>
        <p>
          Most teams already own labelled decisions without realising it: tickets and the queue they ended in, emails and whether they were marked spam,
          prompts and whether a reviewer blocked them, invoices and their disposition. Exporting those as (state, question, answer) rows is usually a
          SQL query, not a labelling project. Where no labels exist, a large LLM can act as a teacher and its probabilities become soft targets; the
          training rewards are proper scoring rules, so the student learns to match honest distributions rather than just argmax labels.
        </p>
        <h3>What would make training possible in the browser one day</h3>
        <p>
          Two things are plausible. First, a much smaller encoder (ModernBERT-base, 149M, scored 0.646 on the same benchmark) with WebGPU training
          could handle the head-only or last-layers case for small datasets. Second, freezing the encoder and training only the 2-layer decision head
          on cached embeddings is a linear-ish problem that a browser can do in minutes. Both are open research directions, and the exported dataset
          format from this Studio would feed either.
        </p>
      </div>
    </Section>
  );
}
