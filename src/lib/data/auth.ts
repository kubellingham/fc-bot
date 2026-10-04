import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";

export interface AuthContext {
  supabase: TypedSupabaseClient;
  user: { id: string; email: string | null };
}

/**
 * Verifies the session for this request (signature-checked JWT claims; for
 * symmetric-key projects this round-trips to Supabase Auth). Memoised per request.
 * The user id comes only from the verified token — never from client input.
 */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") return null;
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  return { supabase, user: { id: sub, email } };
});

/** For pages: redirects to the sign-in page when there is no valid session. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}
