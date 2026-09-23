"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRESETS, type Preset, type Questions } from "@/lib/presets";
import DecisionCard, { type SystemOneResult } from "@/components/DecisionCard";
import Link from "next/link";

type Turn =
  | { role: "user"; state: unknown; questions: Questions; at: number }
  | { role: "model"; result?: SystemOneResult; error?: string; questions: Questions; at: number; pending?: boolean };

const MODELS = [
  { id: "", name: "Auto-route", hint: "Script and language detection picks english or multilingual" },
  { id: "english", name: "English", hint: "ModernBERT-large, 421M, 512 tokens" },
  { id: "multilingual", name: "Multilingual", hint: "mmBERT-base, 322M, 100+ languages" },
  { id: "typed-decisions", name: "Typed decisions", hint: "Fine-tuned for agent, support, invoice and security workflows" },
];

function tryParse(s: string): unknown {
  const t = s.trim();
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try { return JSON.parse(t); } catch { /* fall through */ }
  }
  return null;
}

export default function Playground() {
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [questionsText, setQuestionsText] = useState(JSON.stringify(PRESETS[0].questions, null, 2));
  const [input, setInput] = useState("");
  const [model, setModel] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [showQ, setShowQ] = useState(false);
  const [health, setHealth] = useState<{ status: string; backend?: { loaded?: string[]; device?: string } | null } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ status: "backend-offline" }));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);

  const parsedQ = useMemo(() => {
    try { return { ok: true as const, q: JSON.parse(questionsText) as Questions }; } catch (e) { return { ok: false as const, err: String((e as Error).message) }; }
  }, [questionsText]);

  function choosePreset(p: Preset) {
    setPreset(p);
    setQuestionsText(JSON.stringify(p.questions, null, 2));
  }

  function buildState(text: string): unknown {
    const j = tryParse(text);
    if (j !== null) return j;
    return { [preset.stateKey]: text };
  }

  async function send(text?: string) {
    const raw = (text ?? input).trim();
    if (!raw || !parsedQ.ok) return;
    const state = buildState(raw);
    const q = parsedQ.q;
    const at = Date.now();
    setTurns((t) => [...t, { role: "user", state, questions: q, at }, { role: "model", questions: q, at, pending: true }]);
    setInput("");
    try {
      const r = await fetch("/api/v1/systemone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, questions: q, model: model || undefined }),
      });
      const j = await r.json();
      setTurns((t) => {
        const c = [...t];
        const i = c.findIndex((x) => x.role === "model" && x.at === at);
        if (i >= 0) c[i] = r.ok ? { role: "model", result: j, questions: q, at } : { role: "model", error: typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j), questions: q, at };
        return c;
      });
    } catch (e) {
      setTurns((t) => {
        const c = [...t];
        const i = c.findIndex((x) => x.role === "model" && x.at === at);
        if (i >= 0) c[i] = { role: "model", error: String((e as Error).message), questions: q, at };
        return c;
      });
    }
  }

  const online = health?.status === "ok";

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 lg:py-6 grid lg:grid-cols-[280px_1fr_360px] gap-4 lg:gap-6 min-h-[calc(100dvh-3rem)]">
      {/* Mobile: compact workflow + checkpoint pickers */}
      <div className="lg:hidden -mx-4 px-4 flex gap-2 overflow-x-auto thin-scroll pb-1">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => choosePreset(p)} className={`pill shrink-0 ${preset.id === p.id ? "on" : ""}`}>{p.name}</button>
        ))}
        <select className="select !w-auto shrink-0 !py-1 !text-[13px] !rounded-full" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Checkpoint">
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Left: workflows */}
      <aside className="hidden lg:block lg:sticky lg:top-16 self-start">
        <div className="eyebrow mb-3">Workflow</div>
        <div className="grid gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => choosePreset(p)}
              className={`text-left rounded-2xl px-4 py-3 transition ${preset.id === p.id ? "bg-ink text-bg" : "bg-bg-2 hover:bg-bg-3"}`}
            >
              <div className="font-medium text-[14px]">{p.name}</div>
              <div className={`text-[12px] mt-0.5 leading-snug ${preset.id === p.id ? "opacity-70" : "text-ink-3"}`}>{p.tagline}</div>
            </button>
          ))}
        </div>
        <div className="eyebrow mt-6 mb-3">Checkpoint</div>
        <div className="grid gap-1.5">
          {MODELS.map((m) => (
            <button key={m.id} onClick={() => setModel(m.id)} className={`text-left rounded-2xl px-4 py-2.5 transition ${model === m.id ? "bg-bg-3 ring-1 ring-accent" : "bg-bg-2 hover:bg-bg-3"}`}>
              <div className="font-medium text-[14px]">{m.name}</div>
              <div className="text-[12px] text-ink-3 leading-snug">{m.hint}</div>
            </button>
          ))}
        </div>
        <div className="mt-6 text-[12px] text-ink-3 flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${online ? "bg-teal" : health ? "bg-red-400" : "bg-bg-3"}`} />
          {health === null ? "Checking backend…" : online ? `Model backend online${health.backend?.device ? ` · ${health.backend.device}` : ""}` : "Model backend offline"}
        </div>
        {health && !online && (
          <div className="mt-2 text-[12px] text-ink-2 leading-relaxed">
            The UI runs on Vercel, the model runs on a separate host. <Link className="link" href="/download#self-host">Start one</Link> and set <code className="mono">LAYA_BACKEND_URL</code>.
          </div>
        )}
      </aside>

      {/* Center: chat */}
      <div className="flex flex-col min-h-[70vh]">
        <div className="flex-1 space-y-5 pb-4 thin-scroll">
          {turns.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <img src="/art/hero.webp" alt="" className="w-64 rounded-3xl float" />
              <h1 className="title text-3xl mt-6">Ask Laya to decide.</h1>
              <p className="text-ink-2 mt-2 max-w-md">
                Paste any text, or a JSON object, and every question in the current workflow is answered in one forward pass.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                <button className="pill hover:bg-bg-2" onClick={() => send(typeof preset.sample === "string" ? preset.sample : JSON.stringify(preset.sample, null, 2))}>
                  Try the sample for “{preset.name}”
                </button>
                <button className="pill hover:bg-bg-2" onClick={() => setShowQ(true)}>Edit the questions</button>
              </div>
            </div>
          )}
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-accent text-white px-4 py-3 text-[15px] whitespace-pre-wrap break-words">
                  {typeof t.state === "string" ? t.state : (Object.keys(t.state as object).length === 1 && typeof (t.state as Record<string, unknown>)[preset.stateKey] === "string")
                    ? String((t.state as Record<string, unknown>)[preset.stateKey])
                    : <pre className="mono whitespace-pre-wrap">{JSON.stringify(t.state, null, 2)}</pre>}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-3 items-start">
                <img src="/brand/laya-mark.svg" alt="" width={26} height={26} className="mt-3 shrink-0" />
                <div className="flex-1 min-w-0">
                  {t.pending && (
                    <div className="card p-4 flex items-center gap-3 text-[14px] text-ink-2"><span className="spinner" /> Deciding…</div>
                  )}
                  {t.error && (
                    <div className="card p-4 text-[14px]">
                      <div className="font-medium text-red-500">Could not get a decision</div>
                      <div className="text-ink-2 mt-1 whitespace-pre-wrap">{t.error}</div>
                    </div>
                  )}
                  {t.result && <DecisionCard result={t.result} questions={t.questions} />}
                </div>
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="sticky bottom-4">
          <div className="card p-2 sm:p-3">
            <textarea
              ref={taRef}
              className="textarea !border-0 !shadow-none !bg-transparent !min-h-[56px] max-h-60"
              placeholder={preset.placeholder + "  (or paste a JSON object as the state)"}
              value={input}
              rows={2}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />
            <div className="flex items-center gap-2 px-1 pb-1">
              <button className="pill hover:bg-bg-2 !text-[12px]" onClick={() => setShowQ(!showQ)}>
                {Object.keys(parsedQ.ok ? parsedQ.q : {}).length} questions · {showQ ? "hide" : "edit"}
              </button>
              <button className="pill hover:bg-bg-2 !text-[12px]" onClick={() => setInput(typeof preset.sample === "string" ? preset.sample : JSON.stringify(preset.sample, null, 2))}>Sample</button>
              {turns.length > 0 && <button className="pill hover:bg-bg-2 !text-[12px]" onClick={() => setTurns([])}>Clear</button>}
              <span className="flex-1" />
              <span className="text-[11px] text-ink-3 hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
              <button className="btn btn-primary !py-1.5 !px-4" disabled={!input.trim() || !parsedQ.ok} onClick={() => send()}>Decide</button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: questions */}
      <aside className={`lg:sticky lg:top-16 self-start ${showQ ? "" : "hidden lg:block"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">Questions (JSON)</div>
          <button className="text-[12px] text-accent hover:underline" onClick={() => setQuestionsText(JSON.stringify(preset.questions, null, 2))}>Reset</button>
        </div>
        <textarea
          className={`textarea mono min-h-[60vh] ${parsedQ.ok ? "" : "!border-red-400"}`}
          value={questionsText}
          onChange={(e) => setQuestionsText(e.target.value)}
          spellCheck={false}
        />
        {!parsedQ.ok && <div className="text-[12px] text-red-500 mt-1">{parsedQ.err}</div>}
        <div className="text-[12px] text-ink-3 mt-2 leading-relaxed">
          Each key is a question id. <code className="mono">choice</code> takes a map of option → description, <code className="mono">score</code> a list of levels, <code className="mono">noul</code> just instructions.
          Want to build a schema visually? Use the <Link className="link" href="/studio">Studio</Link>.
        </div>
      </aside>
    </div>
  );
}
