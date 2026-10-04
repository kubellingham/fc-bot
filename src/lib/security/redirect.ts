/**
 * Validates a post-login redirect target. Only same-origin absolute paths are
 * allowed, which prevents open redirects such as `?next=//evil.com` or
 * `?next=https://evil.com`.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || typeof value !== "string") return fallback;
  if (value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Reject control characters and backslashes, which some browsers normalise to "/".
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/portfolio",
  "/watchlist",
  "/trading",
  "/analytics",
  "/alerts",
  "/ai-analyst",
  "/settings",
  "/players",
  "/data",
  "/reset-password",
] as const;

export const AUTH_PAGES = ["/login", "/signup", "/forgot-password"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAuthPage(pathname: string): boolean {
  return (AUTH_PAGES as readonly string[]).includes(pathname);
}
