import { NextResponse } from "next/server";
import { backendFetch, backendInfo } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  const info = backendInfo();
  if (!info.configured) {
    return NextResponse.json({ status: "no-backend", gateway: "ok", backend: null });
  }
  try {
    const r = await backendFetch("/health", { method: "GET" }, 8000);
    const j = await r.json().catch(() => ({}));
    return NextResponse.json({ status: r.ok ? "ok" : "backend-error", gateway: "ok", backend: j });
  } catch (e) {
    return NextResponse.json({ status: "backend-offline", gateway: "ok", backend: null, error: String((e as Error).message) });
  }
}
