import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "de_session";
const SESSION_DAYS = 30;

function secret(): string {
  return process.env.SESSION_SECRET || process.env.PLAYGROUND_PASSCODE || "dev-secret-change-me";
}

export function passcodeConfigured(): boolean {
  return Boolean(process.env.PLAYGROUND_PASSCODE);
}

export function checkPasscode(code: string): boolean {
  const want = process.env.PLAYGROUND_PASSCODE || "";
  if (!want) return true; // no passcode configured: open playground (local dev)
  const a = Buffer.from(code.trim());
  const b = Buffer.from(want.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function mintSession(): string {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const payload = `v1.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [v, exp, sig] = parts;
  if (v !== "v1") return false;
  if (Number(exp) < Date.now()) return false;
  const want = createHmac("sha256", secret()).update(`${v}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function apiKeys(): string[] {
  return (process.env.API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function checkApiKey(header: string | null): boolean {
  if (!header) return false;
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return false;
  const given = Buffer.from(m[1].trim());
  return apiKeys().some((k) => {
    const want = Buffer.from(k);
    return want.length === given.length && timingSafeEqual(want, given);
  });
}

/** True when the request is allowed to call the model: a valid bearer key, a valid session cookie, or nothing configured. */
export function authorized(req: Request): { ok: boolean; via: "key" | "session" | "open" | "none" } {
  const keys = apiKeys();
  const auth = req.headers.get("authorization");
  if (auth && checkApiKey(auth)) return { ok: true, via: "key" };
  const cookie = req.headers.get("cookie") || "";
  const m = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(cookie);
  if (m && verifySession(decodeURIComponent(m[1]))) return { ok: true, via: "session" };
  if (!passcodeConfigured() && keys.length === 0) return { ok: true, via: "open" };
  return { ok: false, via: "none" };
}
