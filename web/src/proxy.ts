import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Optimistic check only — reads the signed cookie, does not hit the database.
// Real authorization (role checks, per-record access) happens in server
// components/actions via getSession() in src/lib/auth.ts.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/employees",
  "/projects",
  "/admin",
  "/departments",
  "/teams",
  "/settings",
  "/forecast",
  "/capacity",
];
const AUTH_ROUTES = ["/login"];

async function hasValidSessionCookie(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("yasa_session")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (!isProtected && !isAuthRoute) return NextResponse.next();

  const authed = await hasValidSessionCookie(req);

  if (isProtected && !authed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isAuthRoute && authed) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/employees/:path*",
    "/projects/:path*",
    "/admin/:path*",
    "/departments/:path*",
    "/teams/:path*",
    "/settings/:path*",
    "/forecast/:path*",
    "/capacity/:path*",
    "/login",
  ],
};
