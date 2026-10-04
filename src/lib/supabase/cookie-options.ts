import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Auth cookies are only ever read on the server (there is no browser Supabase
 * client), so they can be HttpOnly: injected script cannot read session tokens.
 */
export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
