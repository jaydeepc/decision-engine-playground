import Link from "next/link";
import { Section, Eyebrow, H2, Lede } from "@/components/Section";

const STATS = [
  { v: "33 ms", k: "one question, T4 GPU" },
  { v: "7.2 ms", k: "per question, batched" },
  { v: "0", k: "tokens generated" },
  { v: "100+", k: "languages via routing" },
];

const PRIMS = [
  { img: "/art/choice.webp", name: "choice", what: "Pick one option from a list. Returns the pick, a probability for every option, and a confidence.", ex: "Which team owns this ticket?" },
  { img: "/art/score.webp", name: "score", what: "Place the input on an ordinal rubric. Returns the expected level and the distribution over levels.", ex: "How urgent is this, 0 to 3?" },
  { img: "/art/noul.webp", name: "noul", what: "A yes or no question. Returns one calibrated probability that the statement is true.", ex: "Is this email phishing?" },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24 pb-8 text-center">
          <div className="eyebrow fade-up">Open-source · Apache 2.0 · System 1</div>
          <h1 className="display text-5xl sm:text-7xl mt-4 fade-up" style={{ animationDelay: ".05s" }}>
            Decisions, not text.
          </h1>
          <p className="lede mx-auto mt-5 max-w-2xl fade-up" style={{ animationDelay: ".1s" }}>
            Laya is a decision engine. Ask it typed questions about any text or JSON, and it answers with calibrated probabilities in a
            single 33 millisecond forward pass. No tokens, no parsing, no hallucinated confidence.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 fade-up" style={{ animationDelay: ".15s" }}>
            <Link href="/playground" className="btn btn-primary">Open the playground</Link>
            <Link href="/learn" className="btn btn-secondary">How it works</Link>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4">
          <img src="/art/hero.webp" alt="A glass sphere lit from within, representing a single decision" className="w-full rounded-3xl float" width={1600} height={904} />
        </div>
        <div className="mx-auto max-w-4xl px-4 mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.k}>
              <div className="display text-3xl sm:text-4xl">{s.v}</div>
              <div className="text-[13px] text-ink-3 mt-1">{s.k}</div>
            </div>
          ))}
        </div>
      </section>

      <Section tone="tint">
        <Eyebrow>The idea</Eyebrow>
        <H2>Most AI decisions do not need a chatbot.</H2>
        <Lede>
          Routing a ticket, flagging spam, scoring urgency, blocking a jailbreak. These are reflexes, not essays. A generative LLM takes
          half a second to a few seconds to stream tokens you then have to parse. A decision engine reads the input once and returns numbers.
        </Lede>
        <div className="mt-12 grid md:grid-cols-2 gap-6 items-center">
          <img src="/art/reflex.webp" alt="A small bright sphere emitting a streak of light next to a large slow cloud" className="rounded-3xl w-full" width={1600} height={904} />
          <div className="grid gap-4">
            {[
              ["System 2, the LLM", "Generates text token by token. Slow, expensive, and its stated confidence is just more text."],
              ["System 1, the decision engine", "Reads everything at once with a bidirectional encoder. Scores each option directly. Fast, cheap, and the probabilities are trained to be honest."],
              ["Use both", "Let System 1 route, gate and triage in milliseconds. Call the LLM only when the reflex says it is worth it."],
            ].map(([h, p]) => (
              <div key={h} className="card p-5">
                <div className="font-semibold">{h}</div>
                <div className="text-ink-2 mt-1 text-[15px] leading-relaxed">{p}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <Eyebrow>Three primitives</Eyebrow>
        <H2>Every question is one of three shapes.</H2>
        <Lede>Because the output is always a probability distribution over a fixed set of options, malformed JSON and schema violations are impossible.</Lede>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {PRIMS.map((p) => (
            <div key={p.name} className="tile overflow-hidden">
              <img src={p.img} alt="" className="w-full aspect-square object-cover" width={800} height={800} />
              <div className="p-6">
                <div className="mono text-accent">{p.name}</div>
                <div className="font-semibold text-lg mt-1">{p.ex}</div>
                <div className="text-ink-2 mt-2 text-[15px] leading-relaxed">{p.what}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="tint">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <Eyebrow>Playground</Eyebrow>
            <H2>Talk to it like a chat. Get back decisions.</H2>
            <Lede>
              Pick a workflow such as support triage, email routing, guardrails or moderation, paste any text, and watch the model answer every
              question at once with probability bars, ordinal scores and true or false rings. Then edit the questions and ask your own.
            </Lede>
            <Link href="/playground" className="btn btn-primary mt-6">Open the playground</Link>
          </div>
          <div className="card p-5 text-[13px]">
            <div className="text-ink-3 mb-2">You</div>
            <div className="rounded-2xl bg-bg-3 p-3 mb-4">I was charged twice for invoice 4411. Refund the duplicate today or we cancel.</div>
            <div className="text-ink-3 mb-2">Laya · 5 decisions · routed → english</div>
            {[
              ["intent", 99],
              ["refund_requested", 88],
              ["churn_risk", 46],
            ].map(([k, p]) => (
              <div key={String(k)} className="grid grid-cols-[130px_1fr_40px] gap-3 items-center py-1.5">
                <span className="font-medium truncate">{k}</span>
                <div className="bar"><i style={{ width: `${p}%` }} /></div>
                <span className="text-right text-ink-2">{p}%</span>
              </div>
            ))}
            <div className="grid grid-cols-[130px_1fr] gap-3 items-center py-1.5">
              <span className="font-medium">frustration</span>
              <span className="text-ink-2">1.78 / 3 · clearly annoyed</span>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { href: "/build", img: "/art/api.webp", h: "Build with the API", p: "One POST. Jev-compatible wire format. Python, JavaScript and curl examples with your key." },
            { href: "/studio", img: "/art/router.webp", h: "Design your own model", p: "Describe your decisions, test them live, label examples and export a training-ready dataset." },
            { href: "/finetune", img: "/art/finetune.webp", h: "Fine-tune like an SLM", p: "What fine-tuning means for a decision engine, why it is the whole game, and how to do it on free GPUs." },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="tile overflow-hidden group">
              <img src={c.img} alt="" className="w-full aspect-[16/9] object-cover" width={1600} height={904} />
              <div className="p-6">
                <div className="font-semibold text-lg group-hover:text-accent transition">{c.h} →</div>
                <div className="text-ink-2 mt-2 text-[15px] leading-relaxed">{c.p}</div>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
