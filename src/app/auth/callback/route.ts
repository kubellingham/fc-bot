import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/security/redirect";
import { createClient } from "@/lib/supabase/server";

/** PKCE callback for email confirmation and password-reset links (`?code=`). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    logger.warn("auth.callback_failed", { errorCode: error.code ?? "unknown" });
  }
  return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
}
