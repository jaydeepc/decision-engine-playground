"use client";
import { useState } from "react";
import { PRESETS } from "@/lib/presets";

const DEFAULT = JSON.stringify({ state: PRESETS[0].sample, questions: { intent: PRESETS[0].questions.intent, churn_risk: PRESETS[0].questions.churn_risk } }, null, 2);

export default function ApiTry() {
  const [body, setBody] = useState(DEFAULT);
  const [key, setKey] = useState("");
  const [out, setOut] = useState<string>("");
  const [ms, setMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    setOut("");
    const t0 = performance.now();
    try {
      const r = await fetch("/api/v1/systemone", {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body,
      });
      const t = await r.text();
      setMs(Math.round(performance.now() - t0));
      try { setOut(`HTTP ${r.status}\n` + JSON.stringify(JSON.parse(t), null, 2)); } catch { setOut(`HTTP ${r.status}\n` + t); }
    } catch (e) {
      setOut(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-8 grid md:grid-cols-2 gap-5">
      <div>
        <input className="input mb-3" placeholder="API key (optional if signed in)" value={key} onChange={(e) => setKey(e.target.value)} />
        <textarea className="textarea mono min-h-[360px]" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} />
        <button className="btn btn-primary mt-3" onClick={go} disabled={busy}>{busy ? "Sending…" : "POST /api/v1/systemone"}</button>
        {ms !== null && <span className="ml-3 text-[13px] text-ink-3">{ms} ms round trip from your browser</span>}
      </div>
      <pre className="code min-h-[360px] thin-scroll">{out || "// response appears here"}</pre>
    </div>
  );
}
