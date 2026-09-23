import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/playground", "/studio"];
const COOKIE = "de_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!process.env.PLAYGROUND_PASSCODE) return NextResponse.next();
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  const token = req.cookies.get(COOKIE)?.value;
  // Structural check only here (edge runtime); the HMAC is verified in the API routes.
  if (token && token.split(".").length === 3 && Number(token.split(".")[1]) > Date.now()) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/playground/:path*", "/studio/:path*"] };
