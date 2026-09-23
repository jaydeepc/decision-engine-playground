"use client";
import { useState } from "react";
import type { Questions } from "@/lib/presets";

export interface ChoiceAnswer { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
export interface ScoreAnswer { type: "score"; score: number; legend: Record<string, string>; probabilities: Record<string, number>; confidence: number }
export interface NoulAnswer { type: "noul"; noul: number; confidence?: number }
export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export interface SystemOneResult {
  model?: string;
  answers: Record<string, Answer>;
  usage?: { input_tokens: number; output_tokens: number };
  routing?: { model: string; repo?: string; reason: string };
  latency_ms?: number;
  gateway?: { latency_ms: number; auth: string; pre_routing?: { model: string; reason: string } };
}

function pct(x: number) { return `${Math.round(x * 100)}%`; }

function Ring({ value }: { value: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="shrink-0">
      <circle cx="30" cy="30" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="6" />
      <circle
        cx="30" cy="30" r={r} fill="none" stroke="url(#g)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 30 30)" style={{ transition: "stroke-dasharray .6s cubic-bezier(.2,.8,.2,1)" }}
      />
      <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="var(--teal)" /><stop offset="1" stopColor="var(--accent)" /></linearGradient></defs>
      <text x="30" y="34" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">{pct(value)}</text>
    </svg>
  );
}

export function AnswerBlock({ id, q, a }: { id: string; q?: Questions[string]; a: Answer }) {
  const instr = q?.instructions;
  if (a.type === "choice") {
    const entries = Object.entries(a.probabilities).sort((x, y) => y[1] - x[1]);
    return (
      <div className="py-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">choice</span>
            <span className="ml-2 font-medium">{id}</span>
          </div>
          <div className="text-[12px] text-ink-3">confidence {pct(a.confidence)}</div>
        </div>
        {instr && <div className="text-[13px] text-ink-2 mt-0.5">{instr}</div>}
        <div className="mt-2 space-y-1.5">
          {entries.map(([k, p]) => (
            <div key={k} className="grid grid-cols-[minmax(0,140px)_1fr_48px] items-center gap-3 text-[13px]">
              <span className={`truncate ${k === a.choice ? "font-semibold" : "text-ink-2"}`}>{k}</span>
              <div className="bar"><i style={{ width: `${Math.max(2, p * 100)}%`, opacity: k === a.choice ? 1 : 0.45 }} /></div>
              <span className="text-right tabular-nums text-ink-2">{pct(p)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (a.type === "score") {
    const levels = Object.keys(a.legend).map(Number).sort((x, y) => x - y);
    const max = levels.length - 1;
    return (
      <div className="py-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">score</span>
            <span className="ml-2 font-medium">{id}</span>
          </div>
          <div className="text-[12px] text-ink-3">confidence {pct(a.confidence)}</div>
        </div>
        {instr && <div className="text-[13px] text-ink-2 mt-0.5">{instr}</div>}
        <div className="mt-3 flex items-end gap-3">
          <div className="text-3xl font-semibold tabular-nums tracking-tight">{a.score.toFixed(2)}<span className="text-ink-3 text-base font-normal"> / {max}</span></div>
        </div>
        <div className="mt-2 relative h-2 rounded-full bg-bg-3">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(a.score / max) * 100}%`, background: "linear-gradient(90deg,var(--teal),var(--indigo))" }} />
          <div className="absolute -top-1 w-4 h-4 rounded-full bg-bg border-2 border-accent shadow" style={{ left: `calc(${(a.score / max) * 100}% - 8px)` }} />
        </div>
        <div className="mt-3 grid gap-1">
          {levels.map((l) => (
            <div key={l} className="grid grid-cols-[28px_1fr_48px] items-center gap-2 text-[12px]">
              <span className="text-ink-3 tabular-nums">{l}</span>
              <span className="text-ink-2 truncate">{a.legend[String(l)]}</span>
              <span className="text-right tabular-nums text-ink-2">{pct(a.probabilities[String(l)] ?? 0)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="py-3 flex items-center gap-4">
      <Ring value={a.noul} />
      <div className="min-w-0">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">noul</span>
          <span className="ml-2 font-medium">{id}</span>
          <span className={`ml-2 text-[12px] px-2 py-0.5 rounded-full ${a.noul >= 0.5 ? "bg-teal/20 text-ink" : "bg-bg-3 text-ink-2"}`}>{a.noul >= 0.5 ? "likely true" : "likely false"}</span>
        </div>
        {instr && <div className="text-[13px] text-ink-2 mt-0.5">{instr}</div>}
        <div className="text-[12px] text-ink-3 mt-1">P(true) = {a.noul.toFixed(3)}</div>
      </div>
    </div>
  );
}

export default function DecisionCard({ result, questions }: { result: SystemOneResult; questions?: Questions }) {
  const [raw, setRaw] = useState(false);
  const ids = Object.keys(result.answers);
  const routed = result.routing?.model ?? result.gateway?.pre_routing?.model;
  const lat = result.latency_ms ?? result.gateway?.latency_ms;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
        <span className="font-medium text-ink">{ids.length} decision{ids.length === 1 ? "" : "s"}</span>
        {routed && <span className="pill !py-0.5 !text-[11px]">routed → {routed}</span>}
        {typeof lat === "number" && <span className="pill !py-0.5 !text-[11px]">{Math.round(lat)} ms end-to-end</span>}
        {result.usage && <span className="pill !py-0.5 !text-[11px]">{result.usage.input_tokens} tokens in · 0 out</span>}
        <button className="ml-auto text-accent hover:underline" onClick={() => setRaw(!raw)}>{raw ? "Cards" : "Raw JSON"}</button>
      </div>
      {result.routing?.reason && <div className="text-[12px] text-ink-3 mt-1">Router: {result.routing.reason}</div>}
      {raw ? (
        <pre className="code mt-3 thin-scroll max-h-[420px]">{JSON.stringify(result, null, 2)}</pre>
      ) : (
        <div className="mt-2 divide-y divide-line">
          {ids.map((id) => <AnswerBlock key={id} id={id} q={questions?.[id]} a={result.answers[id]} />)}
        </div>
      )}
    </div>
  );
}
