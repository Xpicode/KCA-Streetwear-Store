/**
 * Runs before every page request (Node runtime).
 *
 *  1. Admin gate — a request to /admin/* without a valid signed admin session is sent to the
 *     login page before any page code runs. This also covers RSC payload requests, which a
 *     layout-only check does not (see the Next "Layouts and auth checks" guidance). Pages and
 *     server actions still call requireAdmin() themselves and verify against the database.
 *  2. Content-Security-Policy with a fresh per-request nonce. Next reads the nonce from the
 *     request header and stamps it on its own scripts; app/layout.tsx stamps the theme script.
 */
import { NextResponse, type NextRequest } from "next/server";
import { verifyPayload } from "@/lib/session-token";

const SESSION_COOKIE = "ws_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = verifyPayload<{ kind?: string; id?: number; exp: number }>(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session || session.kind !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    // 'unsafe-eval' only in development: React uses eval there to rebuild server error stacks
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // product photos may be pasted as external https links
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // the admin gate must run on every admin request, prefetch or not
    "/admin/:path*",
    // CSP for everything else that renders a page; skip static assets and link prefetches
    {
      source: "/((?!_next/static|_next/image|favicon\\.ico|uploads/|landing/|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
