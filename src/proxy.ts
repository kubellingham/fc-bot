import { NextResponse, type NextRequest } from "next/server";
import { isAuthPage, isProtectedPath } from "@/lib/security/redirect";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Runs before every page and route handler:
 * 1. issues a per-request CSP nonce,
 * 2. refreshes the Supabase session cookies,
 * 3. optimistically redirects signed-out users away from app pages.
 * Authorization is still enforced by every page, action and RLS policy.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { response, userId } = await updateSession(request, requestHeaders);
  const { pathname, search } = request.nextUrl;

  let result: NextResponse = response;
  if (!userId && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    result = redirectWithCookies(url, response);
  } else if (userId && isAuthPage(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    result = redirectWithCookies(url, response);
  }

  result.headers.set("Content-Security-Policy", csp);
  return result;
}

/** Keeps any refreshed auth cookies when redirecting. */
function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Radix UI and Recharts set inline style attributes, which nonces cannot cover.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // The browser never talks to Supabase or Anthropic directly; all calls are server-side.
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
