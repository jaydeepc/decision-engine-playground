import { NextResponse } from "next/server";
import { checkPasscode, mintSession, SESSION_COOKIE, passcodeConfigured } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "");
  if (!checkPasscode(code)) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ ok: false, error: "That access code is not right." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, mintSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET() {
  return NextResponse.json({ passcodeRequired: passcodeConfigured() });
}
