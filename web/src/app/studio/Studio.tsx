"use client";
import { useEffect, useMemo, useState } from "react";
import DecisionCard, { type SystemOneResult, type Answer } from "@/components/DecisionCard";
import { validateQuestions, type Questions } from "@/lib/presets";
import CodeBlock from "@/components/CodeBlock";

type QType = "choice" | "score" | "noul";
interface QDef { id: string; type: QType; instructions: string; options: { key: string; desc: string }[]; levels: string[] }
interface Example { id: string; text: string; labels: Record<string, string | number | boolean>; pred?: SystemOneResult; note?: string }
interface Model { name: string; description: string; stateKey: string; base: "english" | "multilingual"; questions: QDef[]; examples: Example[] }

const KEY = "de-studio-v1";
const uid = () => Math.random().toString(36).slice(2, 9);

const STARTER: Model = {
  name: "lead-qualifier",
  description: "Qualify inbound sales messages: intent, budget signal, urgency and whether a human should reply today.",
  stateKey: "message",
  base: "english",
  questions: [
    { id: "intent", type: "choice", instructions: "What does the sender want in `message`?", options: [{ key: "demo", desc: "wants to see the product or book a call" }, { key: "pricing", desc: "asks about cost, plans or discounts" }, { key: "support", desc: "an existing customer with a problem" }, { key: "partnership", desc: "wants to partner, resell or integrate" }, { key: "other", desc: "none of the above" }], levels: [] },
    { id: "budget_signal", type: "score", instructions: "How strong is the buying signal in `message`?", options: [], levels: ["browsing, no signal", "curious, some interest", "evaluating, mentions team or timeline", "ready to buy, mentions budget or contract"] },
    { id: "reply_today", type: "noul", instructions: "Should a human reply to `message` today?", options: [], levels: [] },
  ],
  examples: [],
};

function toQuestions(qs: QDef[]): Questions {
  const out: Questions = {};
  for (const q of qs) {
    if (!q.id.trim()) continue;
    if (q.type === "choice") out[q.id] = { type: "choice", instructions: q.instructions, criteria: Object.fromEntries(q.options.filter((o) => o.key.trim()).map((o) => [o.key.trim(), o.desc.trim() || null])) };
    else if (q.type === "score") out[q.id] = { type: "score", instructions: q.instructions, criteria: q.levels.filter((l) => l.trim()) };
    else out[q.id] = { type: "noul", instructions: q.instructions };
  }
  return out;
}

function warnings(qs: QDef[]): string[] {
  const w: string[] = [];
  const ids = qs.map((q) => q.id.trim());
  if (new Set(ids).size !== ids.length) w.push("Question ids must be unique.");
  for (const q of qs) {
    if (!/^[a-z][a-z0-9_]*$/.test(q.id)) w.push(`"${q.id || "(empty)"}": use a snake_case id.`);
    if (q.type === "choice") {
      if (q.options.length > 20) w.push(`"${q.id}": ${q.options.length} options. Accuracy drops sharply past ~20; split coarse-to-fine or shortlist.`);
      if (q.options.some((o) => /^(true|false|yes|no)$/i.test(o.key))) w.push(`"${q.id}": avoid boolean-looking option keys; the model can follow the key instead of the description. Use semantic keys or A/B.`);
      if (q.options.some((o) => !o.desc.trim())) w.push(`"${q.id}": every option should have a short description; the model reads them.`);
    }
    if (q.type === "score" && q.levels.length > 6) w.push(`"${q.id}": more than 6 rubric levels is rarely learnable; consider fewer.`);
    if (!/`\w+`/.test(q.instructions)) w.push(`"${q.id}": mention the state field in backticks, e.g. \`message\`, so the model knows where to look.`);
  }
  return w;
}

export default function Studio() {
  const [m, setM] = useState<Model>(STARTER);
  const [tab, setTab] = useState<"design" | "test" | "label" | "export">("design");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setM(JSON.parse(s)); } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ } }, [m, loaded]);

  const questions = useMemo(() => toQuestions(m.questions), [m.questions]);
  const valid = useMemo(() => validateQuestions(questions), [questions]);
  const warns = useMemo(() => warnings(m.questions), [m.questions]);
  const update = (patch: Partial<Model>) => setM((x) => ({ ...x, ...patch }));
  const setQ = (i: number, patch: Partial<QDef>) => setM((x) => ({ ...x, questions: x.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(["design", "test", "label", "export"] as const).map((t, i) => (
          <button key={t} onClick={() => setTab(t)} className={`pill ${tab === t ? "on" : "hover:bg-bg-2"}`}>{i + 1}. {t[0].toUpperCase() + t.slice(1)}</button>
        ))}
        <span className="flex-1" />
        <span className="text-[12px] text-ink-3">{m.questions.length} questions · {m.examples.length} labelled examples · saved in this browser</span>
        <button className="text-[12px] text-accent hover:underline" onClick={() => { if (confirm("Reset the studio to the starter model?")) setM(STARTER); }}>Reset</button>
      </div>

      {tab === "design" && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="grid gap-4">
            <div className="card p-5 grid sm:grid-cols-2 gap-3">
              <label className="text-[13px] text-ink-2">Model name<input className="input mt-1" value={m.name} onChange={(e) => update({ name: e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() })} /></label>
              <label className="text-[13px] text-ink-2">State field the questions refer to<input className="input mt-1 mono" value={m.stateKey} onChange={(e) => update({ stateKey: e.target.value })} /></label>
              <label className="text-[13px] text-ink-2 sm:col-span-2">What this model decides<input className="input mt-1" value={m.description} onChange={(e) => update({ description: e.target.value })} /></label>
              <label className="text-[13px] text-ink-2">Base checkpoint
                <select className="select mt-1" value={m.base} onChange={(e) => update({ base: e.target.value as Model["base"] })}>
                  <option value="english">english · ModernBERT-large 421M · best for English</option>
                  <option value="multilingual">multilingual · mmBERT-base 322M · 100+ languages, 2x faster</option>
                </select>
              </label>
            </div>
            {m.questions.map((q, i) => (
              <div key={i} className="card p-5">
                <div className="flex flex-wrap gap-2 items-center">
                  <input className="input !w-44 mono" value={q.id} placeholder="question_id" onChange={(e) => setQ(i, { id: e.target.value })} />
                  <select className="select !w-32" value={q.type} onChange={(e) => setQ(i, { type: e.target.value as QType })}>
                    <option value="choice">choice</option><option value="score">score</option><option value="noul">noul</option>
                  </select>
                  <span className="flex-1" />
                  <button className="text-[12px] text-ink-3 hover:text-red-500" onClick={() => update({ questions: m.questions.filter((_, j) => j !== i) })}>Remove</button>
                </div>
                <input className="input mt-3" value={q.instructions} placeholder="Instructions, e.g. What does the sender want in `message`?" onChange={(e) => setQ(i, { instructions: e.target.value })} />
                {q.type === "choice" && (
                  <div className="mt-3 grid gap-2">
                    {q.options.map((o, k) => (
                      <div key={k} className="grid grid-cols-[140px_1fr_28px] gap-2 items-center">
                        <input className="input mono" value={o.key} placeholder="key" onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? { ...x, key: e.target.value } : x)) })} />
                        <input className="input" value={o.desc} placeholder="short description the model reads" onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? { ...x, desc: e.target.value } : x)) })} />
                        <button className="text-ink-3 hover:text-red-500" onClick={() => setQ(i, { options: q.options.filter((_, j) => j !== k) })}>×</button>
                      </div>
                    ))}
                    <button className="text-[13px] text-accent text-left" onClick={() => setQ(i, { options: [...q.options, { key: "", desc: "" }] })}>+ option</button>
                  </div>
                )}
                {q.type === "score" && (
                  <div className="mt-3 grid gap-2">
                    {q.levels.map((l, k) => (
                      <div key={k} className="grid grid-cols-[40px_1fr_28px] gap-2 items-center">
                        <span className="text-ink-3 text-[13px] text-center">{k}</span>
                        <input className="input" value={l} placeholder={`what level ${k} means`} onChange={(e) => setQ(i, { levels: q.levels.map((x, j) => (j === k ? e.target.value : x)) })} />
                        <button className="text-ink-3 hover:text-red-500" onClick={() => setQ(i, { levels: q.levels.filter((_, j) => j !== k) })}>×</button>
                      </div>
                    ))}
                    <button className="text-[13px] text-accent text-left" onClick={() => setQ(i, { levels: [...q.levels, ""] })}>+ level</button>
                  </div>
                )}
                {q.type === "noul" && <div className="text-[12px] text-ink-3 mt-2">Returns P(true). Phrase it as a statement that is true or false about the state.</div>}
              </div>
            ))}
            <button className="btn btn-secondary justify-self-start" onClick={() => update({ questions: [...m.questions, { id: `q${m.questions.length + 1}`, type: "noul", instructions: "", options: [], levels: [] }] })}>+ Add a question</button>
          </div>
          <aside className="lg:sticky lg:top-16 self-start grid gap-4">
            <div className="card p-4">
              <div className="eyebrow mb-2">Schema check</div>
              {!valid.ok && <div className="text-[13px] text-red-500">{valid.error}</div>}
              {valid.ok && warns.length === 0 && <div className="text-[13px] text-teal">Looks good. Go to Test.</div>}
              <ul className="text-[13px] text-ink-2 space-y-1.5 mt-1">{warns.map((w) => <li key={w}>· {w}</li>)}</ul>
            </div>
            <div className="card p-4">
              <div className="eyebrow mb-2">questions.json</div>
              <pre className="code !text-[11px] max-h-[50vh] thin-scroll">{JSON.stringify(questions, null, 2)}</pre>
            </div>
          </aside>
        </div>
      )}

      {tab === "test" && <TestTab m={m} questions={questions} valid={valid.ok} onAdd={(ex) => update({ examples: [...m.examples, ex] })} />}
      {tab === "label" && <LabelTab m={m} questions={questions} setM={setM} />}
      {tab === "export" && <ExportTab m={m} questions={questions} />}
    </div>
  );
}

function answerToLabel(a: Answer): string | number | boolean {
  if (a.type === "choice") return a.choice;
  if (a.type === "score") { let best = 0, bp = -1; for (const [k, p] of Object.entries(a.probabilities)) if (p > bp) { bp = p; best = Number(k); } return best; }
  return a.noul >= 0.5;
}

function TestTab({ m, questions, valid, onAdd }: { m: Model; questions: Questions; valid: boolean; onAdd: (e: Example) => void }) {
  const [text, setText] = useState("");
  const [res, setRes] = useState<SystemOneResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setErr(null); setRes(null);
    const r = await fetch("/api/v1/systemone", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: { [m.stateKey]: text }, questions, model: m.base }) });
    const j = await r.json();
    setBusy(false);
    if (r.ok) setRes(j); else setErr(typeof j.detail === "string" ? j.detail : JSON.stringify(j));
  }
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div>
        <textarea className="textarea min-h-[160px]" placeholder={`Paste an example ${m.stateKey}…`} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex gap-2 mt-3">
          <button className="btn btn-primary" disabled={!valid || !text.trim() || busy} onClick={run}>{busy ? "Deciding…" : "Run zero-shot"}</button>
          {res && <button className="btn btn-secondary" onClick={() => { onAdd({ id: uid(), text, labels: Object.fromEntries(Object.entries(res.answers).map(([k, a]) => [k, answerToLabel(a)])), pred: res }); setText(""); setRes(null); }}>Add to dataset with these answers</button>}
        </div>
        <p className="text-[13px] text-ink-2 mt-4 leading-relaxed">
          Zero-shot is the base model guessing from your option descriptions alone. Where it is already right, keep the answers. Where it is wrong, add the example anyway and fix the label in the next step. Those corrections are the examples that teach it most.
        </p>
      </div>
      <div>
        {err && <div className="card p-4 text-[14px] text-red-500">{err}</div>}
        {res && <DecisionCard result={res} questions={questions} />}
        {!res && !err && <div className="tile p-8 text-center text-ink-3 text-[14px]">The decision card appears here.</div>}
      </div>
    </div>
  );
}

function LabelTab({ m, questions, setM }: { m: Model; questions: Questions; setM: React.Dispatch<React.SetStateAction<Model>> }) {
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const setEx = (id: string, patch: Partial<Example>) => setM((x) => ({ ...x, examples: x.examples.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  async function prelabel(ex: Example) {
    const r = await fetch("/api/v1/systemone", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: { [m.stateKey]: ex.text }, questions, model: m.base }) });
    if (!r.ok) return;
    const j: SystemOneResult = await r.json();
    setEx(ex.id, { pred: j, labels: { ...Object.fromEntries(Object.entries(j.answers).map(([k, a]) => [k, answerToLabel(a)])), ...ex.labels } });
  }
  async function addBulk() {
    const lines = bulk.split(/\n\s*\n|\n(?=\S)/).map((s) => s.trim()).filter(Boolean);
    const exs = lines.map((t) => ({ id: uid(), text: t, labels: {} as Example["labels"] }));
    setM((x) => ({ ...x, examples: [...x.examples, ...exs] }));
    setBulk("");
    setBusy(true);
    for (const ex of exs) await prelabel(ex);
    setBusy(false);
  }
  const agree = m.examples.filter((e) => e.pred && Object.entries(e.labels).every(([k, v]) => e.pred!.answers[k] && answerToLabel(e.pred!.answers[k]) === v)).length;
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="grid gap-3">
        {m.examples.length === 0 && <div className="tile p-8 text-center text-ink-3 text-[14px]">No examples yet. Add some on the right, or from the Test tab.</div>}
        {m.examples.map((ex, n) => (
          <div key={ex.id} className="card p-4">
            <div className="flex items-start gap-3">
              <span className="text-[12px] text-ink-3 mt-1 w-6">{n + 1}</span>
              <textarea className="textarea !min-h-[56px] flex-1" value={ex.text} onChange={(e) => setEx(ex.id, { text: e.target.value })} />
              <button className="text-[12px] text-ink-3 hover:text-red-500" onClick={() => setM((x) => ({ ...x, examples: x.examples.filter((e) => e.id !== ex.id) }))}>Remove</button>
            </div>
            <div className="mt-3 grid sm:grid-cols-2 gap-2 pl-9">
              {Object.entries(questions).map(([qid, q]) => {
                const p = ex.pred?.answers[qid];
                const ml = p ? answerToLabel(p) : undefined;
                const v = ex.labels[qid];
                const wrong = ml !== undefined && v !== undefined && ml !== v;
                return (
                  <label key={qid} className="text-[12px] text-ink-2">
                    <span className="mono">{qid}</span> {p && <span className={`ml-1 ${wrong ? "text-red-500" : "text-ink-3"}`}>model: {String(ml)}{p.type !== "noul" ? ` (${Math.round(("confidence" in p ? p.confidence : 0) * 100)}%)` : ` (${Math.round((p as { noul: number }).noul * 100)}%)`}</span>}
                    {q.type === "choice" && (
                      <select className="select mt-1" value={String(v ?? "")} onChange={(e) => setEx(ex.id, { labels: { ...ex.labels, [qid]: e.target.value } })}>
                        <option value="">—</option>{Object.keys(q.criteria as object).map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    )}
                    {q.type === "score" && (
                      <select className="select mt-1" value={String(v ?? "")} onChange={(e) => setEx(ex.id, { labels: { ...ex.labels, [qid]: Number(e.target.value) } })}>
                        <option value="">—</option>{(q.criteria as string[]).map((l, i) => <option key={i} value={i}>{i} · {l}</option>)}
                      </select>
                    )}
                    {q.type === "noul" && (
                      <select className="select mt-1" value={v === undefined ? "" : String(v)} onChange={(e) => setEx(ex.id, { labels: { ...ex.labels, [qid]: e.target.value === "true" } })}>
                        <option value="">—</option><option value="true">true</option><option value="false">false</option>
                      </select>
                    )}
                  </label>
                );
              })}
            </div>
            {!ex.pred && <button className="ml-9 mt-2 text-[12px] text-accent" onClick={() => prelabel(ex)}>Pre-label with the model</button>}
          </div>
        ))}
      </div>
      <aside className="lg:sticky lg:top-16 self-start grid gap-4">
        <div className="card p-4">
          <div className="eyebrow mb-2">Add examples</div>
          <textarea className="textarea !min-h-[140px]" placeholder={`One ${m.stateKey} per paragraph. Separate with a blank line.`} value={bulk} onChange={(e) => setBulk(e.target.value)} />
          <button className="btn btn-primary mt-2 w-full" disabled={!bulk.trim() || busy} onClick={addBulk}>{busy ? "Pre-labelling…" : "Add and pre-label"}</button>
        </div>
        <div className="card p-4 text-[13px] text-ink-2 leading-relaxed">
          <div className="eyebrow mb-2">Progress</div>
          <div><span className="text-ink font-medium">{m.examples.length}</span> examples · zero-shot agrees with your labels on <span className="text-ink font-medium">{agree}</span>.</div>
          <div className="mt-2">Rule of thumb from the Laya benchmarks: a few hundred decisions per question is enough to refit calibration; 1,000 to 10,000 moves accuracy.</div>
        </div>
      </aside>
    </div>
  );
}

function ExportTab({ m, questions }: { m: Model; questions: Questions }) {
  const rows = m.examples.filter((e) => e.text.trim() && Object.keys(e.labels).length > 0).map((e) => {
    const gold: Record<string, unknown> = {};
    for (const [qid, v] of Object.entries(e.labels)) {
      const q = questions[qid]; if (!q) continue;
      const p = e.pred?.answers[qid];
      if (q.type === "choice") {
        const keys = Object.keys(q.criteria as object);
        const probs = p && p.type === "choice" && p.choice === v ? p.probabilities : Object.fromEntries(keys.map((k) => [k, k === v ? 1 : 0]));
        gold[qid] = { label: v, probabilities: probs };
      } else if (q.type === "score") {
        const n = (q.criteria as string[]).length;
        const probs = p && p.type === "score" && answerToLabel(p) === v ? p.probabilities : Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), i === v ? 1 : 0]));
        gold[qid] = { label: v, score: v, probabilities: probs };
      } else {
        const pt = p && p.type === "noul" && (p.noul >= 0.5) === v ? p.noul : (v ? 1 : 0);
        gold[qid] = { label: v ? "true" : "false", noul: pt, probabilities: { true: pt, false: 1 - pt } };
      }
    }
    return JSON.stringify({ id: e.id, state: { [m.stateKey]: e.text }, questions, gold });
  });
  const jsonl = rows.join("\n");
  const spec = JSON.stringify({ name: m.name, description: m.description, base: m.base === "english" ? "convaiinnovations/laya" : "convaiinnovations/laya/multilingual", state_key: m.stateKey, questions, n_examples: rows.length, exported_at: new Date().toISOString() }, null, 2);
  const dl = (name: string, content: string, type = "application/json") => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
  };
  const cmd = `# 1. Put the exported files next to the training script
git clone https://github.com/jaydeepc/decision-engine-playground && cd decision-engine-playground/training
pip install -r requirements.txt

# 2. Fine-tune (Apple Silicon: --device mps · NVIDIA: --device cuda · anything: --device cpu)
python finetune.py --data ${m.name}.jsonl --base ${m.base} --out ../models/${m.name} \\
  --epochs 4 --device mps

# 3. Serve your model
LAYA_LOCAL_MODEL_DIR=$PWD/../models/${m.name} uvicorn app:app --app-dir ../api --port 8000

# Free GPUs instead: open the Kaggle 2xT4 notebook and point it at ${m.name}.jsonl
# https://github.com/NandhaKishorM/laya/blob/main/notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb`;
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="grid gap-4 content-start">
        <div className="card p-5">
          <div className="font-semibold">Dataset · {rows.length} rows</div>
          <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">JSON Lines in the same shape as the public typed-decisions benchmark: state, questions and a gold answer with probabilities per question. Where your label agrees with the model, its distribution is kept as a soft target; where you corrected it, the target is one-hot.</p>
          <div className="mt-3 flex gap-2"><button className="btn btn-primary" disabled={!rows.length} onClick={() => dl(`${m.name}.jsonl`, jsonl, "application/jsonl")}>Download {m.name}.jsonl</button></div>
        </div>
        <div className="card p-5">
          <div className="font-semibold">Model spec</div>
          <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">Your questions and base checkpoint. Load it in the playground's question editor, or ship it with your app: a spec plus the base checkpoint is already a working "schema model".</p>
          <div className="mt-3 flex gap-2"><button className="btn btn-secondary" onClick={() => dl(`${m.name}.spec.json`, spec)}>Download spec</button><button className="btn btn-secondary" onClick={() => dl(`${m.name}.questions.json`, JSON.stringify(questions, null, 2))}>Download questions.json</button></div>
        </div>
        <div className="card p-5">
          <div className="font-semibold">Train it</div>
          <CodeBlock code={cmd} lang="bash" />
        </div>
      </div>
      <div>
        <div className="eyebrow mb-2">Preview · first rows</div>
        <pre className="code !text-[11px] max-h-[70vh] thin-scroll">{rows.slice(0, 5).map((r) => JSON.stringify(JSON.parse(r), null, 1)).join("\n\n") || "// label some examples first"}</pre>
      </div>
    </div>
  );
}
