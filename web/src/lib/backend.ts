export interface BackendInfo {
  configured: boolean;
  url?: string;
}

export function backendInfo(): BackendInfo {
  const url = (process.env.LAYA_BACKEND_URL || "").replace(/\/+$/, "");
  return { configured: Boolean(url), url: url || undefined };
}

export async function backendFetch(path: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<Response> {
  const { url } = backendInfo();
  if (!url) throw new Error("no backend configured");
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");
  headers.set("ngrok-skip-browser-warning", "1");
  headers.set("user-agent", "decision-engine-gateway/1.0");
  const key = process.env.LAYA_BACKEND_KEY;
  if (key) headers.set("authorization", `Bearer ${key}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${url}${path}`, { ...init, headers, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export const OFFLINE_MESSAGE =
  "The model backend is not reachable. The playground UI is hosted on Vercel, but the 421M-parameter model needs a real machine. Run `api/` locally or on any GPU/CPU host and set LAYA_BACKEND_URL. See the Download page.";
