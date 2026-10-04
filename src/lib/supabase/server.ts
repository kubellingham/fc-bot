import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";
import type { Database } from "./database.types";

export type TypedSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Supabase client bound to the current request's auth cookies. Every query runs
 * as the signed-in user, so RLS policies are always enforced. There is no
 * service-role client anywhere in this application.
 */
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}
