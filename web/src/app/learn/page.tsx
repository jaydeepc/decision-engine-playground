import Link from "next/link";
import { Section, Eyebrow, H1, H2, Lede } from "@/components/Section";
import CodeBlock from "@/components/CodeBlock";

export const metadata = { title: "What is a decision engine · Laya" };

const SEQ = `[CLS] choice question: Which team should handle this? [SEP]
[MASK] billing: invoices, payments, refunds
[MASK] technical: bugs, outages
[MASK] security: phishing, account compromise
[SEP] {"subject": "Duplicate charge", "body": "Billed twice…"} [SEP]`;

export default function Learn() {
  return (
    <>
      <Section className="!pb-8">
        <Eyebrow>Learn</Eyebrow>
        <H1>What is a decision engine?</H1>
        <Lede>
          A decision engine is a model that answers structured questions about an input with probabilities, instead of writing text. Laya is an
          open-source one. This page explains it the simple way first, then the engineering underneath.
        </Lede>
      </Section>

      <Section tone="tint" className="!pt-10">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="prose">
            <h2 className="!mt-0">The one-minute version</h2>
            <p>
              Imagine a very well-read colleague who never speaks. You hand them a support email and a form with three questions: which team should
              take this, how urgent is it from 0 to 3, and is the customer threatening to leave. They read the email once and tick the form,
              writing a probability next to every box.
            </p>
            <p>That colleague is a decision engine. Three things make it different from asking a chatbot:</p>
            <ul>
              <li><strong>It reads, it does not write.</strong> No tokens are generated, so there is nothing to parse and nothing to hallucinate.</li>
              <li><strong>It answers every question at once.</strong> All questions are scored in one pass over the input, about 33 ms on a small GPU.</li>
              <li><strong>Its probabilities mean something.</strong> It is trained with scoring rules that reward honesty, so 0.9 really is about nine times out of ten.</li>
            </ul>
          </div>
          <img src="/art/reflex.webp" alt="" className="rounded-3xl w-full" width={1600} height={904} />
        </div>
      </Section>

      <Section>
        <Eyebrow>System 1 and System 2</Eyebrow>
        <H2>Fast reflexes and slow reasoning are different jobs.</H2>
        <div className="prose mt-6 max-w-3xl">
          <p>
            Psychologists describe two modes of thinking. System 1 is fast, automatic and pattern based: you recognise a face, sense that an email is
            spam, feel that a message is angry. System 2 is slow and deliberate: you write a paragraph, plan a refactor, weigh a legal argument.
          </p>
          <p>
            Large language models are System 2 machines. They are wonderful at it, and wasteful when the job is a reflex. Most of the decisions in a
            software pipeline are reflexes: which queue, which model, block or allow, how severe, does this passage answer the query. Sending each of
            those through a 70B-parameter text generator costs hundreds of milliseconds and real money, and you still have to regex the label out of
            prose.
          </p>
          <p>
            A decision engine is the System 1 half. It is small, it is a single forward pass, and it plugs in front of or beside your LLM. Laya
            calls this a <em>System 1 decision engine</em>, and the questions it evaluates are called <em>typed decisions</em>.
          </p>
        </div>
      </Section>

      <Section tone="tint">
        <Eyebrow>Primitives</Eyebrow>
        <H2>Three question types cover almost everything.</H2>
        <div className="mt-10 grid md:grid-cols-3 gap-6">
          {[
            { img: "/art/choice.webp", n: "choice", d: "Pick one key from a dictionary of options. You get the winning key, a probability for each option and a confidence score derived from the entropy of that distribution.", ex: `"queue": {"type": "choice",\n  "instructions": "Which team owns this?",\n  "criteria": {"billing": "refunds, invoices",\n               "tech": "bugs, outages"}}` },
            { img: "/art/score.webp", n: "score", d: "Place the input on an ordered rubric such as levels 0, 1, 2, 3. You get the expected level as a decimal, the probability of each level and a confidence.", ex: `"urgency": {"type": "score",\n  "instructions": "How urgent?",\n  "criteria": ["not urgent", "soon",\n               "blocking"]}` },
            { img: "/art/noul.webp", n: "noul", d: "A yes or no question. You get one number, P(true), between 0 and 1. The name is a nod to the Malayalam word for 'is it so'.", ex: `"churn": {"type": "noul",\n  "instructions": "Does the customer\n   threaten to cancel?"}` },
          ].map((p) => (
            <div key={p.n} className="card overflow-hidden">
              <img src={p.img} alt="" className="w-full aspect-[16/10] object-cover" />
              <div className="p-5">
                <div className="mono text-accent">{p.n}</div>
                <p className="text-[15px] text-ink-2 mt-2 leading-relaxed">{p.d}</p>
                <pre className="code mt-3 !text-[12px]">{p.ex}</pre>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <Eyebrow>Under the hood</Eyebrow>
        <H2>How Laya actually decides.</H2>
        <div className="prose mt-6 max-w-3xl">
          <h3>1. Everything becomes one sequence</h3>
          <p>
            For each question, the question type, the instructions, every option and the whole state are laid out as one token sequence. Each option
            is preceded by a special <code>[MASK]</code> token that acts as a slot for that option.
          </p>
          <CodeBlock code={SEQ} title="What the encoder sees for one choice question" />
          <h3>2. A bidirectional encoder reads it all at once</h3>
          <p>
            The backbone is <strong>ModernBERT-large</strong> (421M parameters, 512 tokens) for English, or <strong>mmBERT-base</strong> (322M,
            1,024 tokens, a 256k-token vocabulary that covers 100+ languages). Unlike a GPT-style decoder, every token attends to every other token
            in both directions, so the option slots can look at the state and the state can look at the options. There is no left-to-right generation.
          </p>
          <h3>3. A small decision head scores each slot</h3>
          <p>
            On top of the encoder sits a two-layer transformer <em>decision head</em> and a tiny scorer MLP. The head adds an embedding for the question
            type, reads the hidden vector at every <code>[MASK]</code> slot, and turns each into a single logit. A softmax over the slots is the answer:
            a distribution over options for <code>choice</code>, over levels for <code>score</code>, over [false, true] for <code>noul</code>.
          </p>
          <h3>4. Calibration makes the numbers honest</h3>
          <p>
            The logits are divided by a fitted <em>temperature</em> per question type and option count before the softmax. That one scalar is what turns a
            raw, over-confident network into probabilities you can branch on. Confidence is reported as one minus the normalised entropy of the
            distribution: 1.0 when all mass is on one option, 0.0 when it is uniform.
          </p>
          <h3>5. Training: reinforcement learning against proper scoring rules</h3>
          <p>
            Laya is trained with what its author calls <strong>RLCD</strong>, Reinforcement Learning for Calibrated Decisions. The reward for a reported
            distribution is a sum of <em>strictly proper scoring rules</em>: the log score, the spherical score, and for ordinal questions the ranked
            probability score. Strictly proper means the only way to maximise expected reward is to report your true belief. Training samples noisy
            versions of the logits, compares the rewards within a group, and pushes the policy toward the samples that scored better, in the style of
            GRPO. A supervised cross-entropy term on soft targets keeps it anchored.
          </p>
          <h3>6. Routing happens before the forward pass</h3>
          <div className="not-prose my-4"><img src="/art/router.webp" alt="" className="rounded-3xl w-full" /></div>
          <p>
            The English checkpoint cannot read Khmer, Hindi or Hebrew, yet it stays 90% confident while scoring at chance. Confidence gating cannot
            catch that. So Laya inspects the Unicode script and function words of the input in well under a millisecond, in pure Python, and sends the
            request to the English or multilingual checkpoint <em>before</em> any model runs. The <Link className="link" href="/playground">playground</Link> shows
            the routing decision on every reply, and this site's <code>/api/v1/route</code> endpoint runs that logic on Vercel with no model at all.
          </p>
        </div>
      </Section>

      <Section tone="tint">
        <Eyebrow>Honest limits</Eyebrow>
        <H2>Where it is weak, in the author's own words.</H2>
        <div className="prose mt-6 max-w-3xl">
          <ul>
            <li><strong>Zero-shot is a starting point, not an oracle.</strong> On the typed-decisions benchmark the base checkpoints score near chance; the fine-tuned checkpoint scores 0.766. Fine-tuning is where the value is. See <Link className="link" href="/finetune">Fine-tune</Link>.</li>
            <li><strong>Keep choice questions under about 20 options.</strong> Options share a fixed token budget in the sequence head; with 77 options each gets 3 to 4 tokens and accuracy collapses (0.425 on Banking77). Shortlist with embeddings or split coarse-to-fine.</li>
            <li><strong>Ordinal score is the weakest primitive</strong> and the multilingual checkpoint rarely picks the first level.</li>
            <li><strong>noul can follow its labels instead of the text</strong> on the English checkpoint. Validate on your own data, or phrase it as a two-option choice with neutral keys.</li>
            <li><strong>Raw temperatures are over-confident.</strong> Refit one temperature per question type on a held-out slice of your data; that alone moved ECE from 0.466 to 0.081.</li>
          </ul>
        </div>
      </Section>

      <Section>
        <Eyebrow>Numbers</Eyebrow>
        <H2>Measured, not marketed.</H2>
        <Lede>All Laya figures are measured by its author on a T4. Comparison figures for the proprietary TypeSafe Jev model are third-party published.</Lede>
        <div className="prose mt-8 max-w-3xl">
          <table>
            <thead><tr><th>Benchmark</th><th>Jev 1.13.0</th><th>Laya (routed)</th></tr></thead>
            <tbody>
              <tr><td>typed-decisions, 2,000 decisions</td><td>0.727</td><td><strong>0.766</strong></td></tr>
              <tr><td>AG News, 4 labels</td><td>0.910</td><td><strong>0.950</strong></td></tr>
              <tr><td>DAIR Emotion, 6 labels</td><td>0.480</td><td><strong>0.595</strong></td></tr>
              <tr><td>Banking77, 77 labels</td><td><strong>0.870</strong></td><td>0.425</td></tr>
              <tr><td>Calibration error (ECE), lower is better</td><td>0.246</td><td><strong>0.081</strong></td></tr>
              <tr><td>Latency p50, one question</td><td>236 to 276 ms</td><td><strong>32.8 ms</strong></td></tr>
              <tr><td>Cost per million tokens</td><td>$0.042</td><td><strong>$0, self-hosted</strong></td></tr>
            </tbody>
          </table>
          <p className="text-[13px] text-ink-3">Email spam (Enron) 0.993 accuracy · Phishing 0.980 · Jailbreak detection 0.755 to 0.762, 0.931 at 50% selective coverage · 45 of 51 languages usable with routing.</p>
        </div>
        <img src="/art/benchmarks.png" alt="Laya benchmark board" className="mt-8 rounded-2xl w-full border border-line" />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/playground" className="btn btn-primary">Try it in the playground</Link>
          <a href="https://laya.convaiinnovations.com/" className="btn btn-secondary">Read the original research post</a>
        </div>
      </Section>
    </>
  );
}
