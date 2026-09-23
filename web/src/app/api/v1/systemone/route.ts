import { NextResponse } from "next/server";
import { authorized } from "@/lib/auth";
import { backendFetch, backendInfo, OFFLINE_MESSAGE } from "@/lib/backend";
import { validateQuestions } from "@/lib/presets";
import { route as routeDecision } from "@/lib/routing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_STATE_CHARS = 20_000;

export async function POST(req: Request) {
  const auth = authorized(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "unauthorized", detail: "Send `Authorization: Bearer <api key>` or sign in to the playground." },
      { status: 401 },
    );
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request", detail: "body must be JSON" }, { status: 400 });
  }
  const state = body.state;
  if (state === undefined || state === null) return NextResponse.json({ error: "bad_request", detail: "`state` is required" }, { status: 400 });
  if (JSON.stringify(state).length > MAX_STATE_CHARS)
    return NextResponse.json({ error: "bad_request", detail: `state is too large (max ${MAX_STATE_CHARS} chars)` }, { status: 413 });
  const v = validateQuestions(body.questions);
  if (!v.ok) return NextResponse.json({ error: "bad_request", detail: v.error }, { status: 400 });

  const model = typeof body.model === "string" ? body.model : undefined;
  const pre = routeDecision(state);
  if (!backendInfo().configured) {
    return NextResponse.json({ error: "backend_unavailable", detail: OFFLINE_MESSAGE, routing: pre }, { status: 503 });
  }
  const t0 = Date.now();
  try {
    const r = await backendFetch("/v1/systemone", { method: "POST", body: JSON.stringify({ state, questions: v.questions, model }) });
    const text = await r.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = { detail: text }; }
    if (!r.ok) {
      const detail = (json as { detail?: unknown }).detail ?? text;
      return NextResponse.json({ error: "backend_error", detail, routing: pre }, { status: r.status === 401 ? 502 : r.status });
    }
    const out = json as Record<string, unknown>;
    out.gateway = { latency_ms: Date.now() - t0, auth: auth.via, pre_routing: pre };
    return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const msg = (e as Error).name === "AbortError" ? "backend timed out" : String((e as Error).message);
    return NextResponse.json({ error: "backend_unavailable", detail: `${OFFLINE_MESSAGE} (${msg})`, routing: pre }, { status: 503 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
    },
  });
}
