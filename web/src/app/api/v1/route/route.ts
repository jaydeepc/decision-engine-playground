import { NextResponse } from "next/server";
import { route } from "@/lib/routing";

export const dynamic = "force-dynamic";

/** Sub-millisecond routing decision, no model needed. Runs entirely on Vercel. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || body.state === undefined) return NextResponse.json({ error: "bad_request", detail: "`state` is required" }, { status: 400 });
  const t0 = performance.now();
  const d = route(body.state, { default: body.default === "multilingual" ? "multilingual" : "english" });
  return NextResponse.json({ ...d, latency_ms: Math.round((performance.now() - t0) * 1000) / 1000 });
}
