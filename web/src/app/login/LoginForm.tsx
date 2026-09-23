"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    setBusy(false);
    if (r.ok) {
      router.replace(params.get("next") || "/playground");
      router.refresh();
    } else {
      const j = await r.json().catch(() => ({}));
      setErr(j.error || "That code is not right.");
    }
  }
  return (
    <form onSubmit={submit} className="card p-6 mt-8 grid gap-3">
      <input autoFocus className="input text-center tracking-[0.3em] font-mono text-lg" placeholder="••••••••" value={code} onChange={(e) => setCode(e.target.value)} />
      {err && <div className="text-[13px] text-red-500 text-center">{err}</div>}
      <button className="btn btn-primary" disabled={busy || !code}>{busy ? "Checking…" : "Continue"}</button>
      <div className="text-[12px] text-ink-3 text-center">Everything else on this site, including the docs and downloads, is open.</div>
    </form>
  );
}
