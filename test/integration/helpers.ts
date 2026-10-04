import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { stackConfig } from "../../scripts/local-supabase-lib.mjs";

export const stack = (() => {
  const local = stackConfig();
  return {
    url: process.env.SUPABASE_TEST_URL ?? local.url,
    anonKey: process.env.SUPABASE_TEST_ANON_KEY ?? local.anonKey,
    dbUrl: process.env.SUPABASE_TEST_DB_URL ?? local.dbUrl,
  };
})();

export function anonClient(): SupabaseClient {
  return createClient(stack.url, stack.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

/** Signs up a fresh user through the real Auth API and returns a client holding their session. */
export async function createTestUser(label = "user"): Promise<TestUser> {
  const client = anonClient();
  const email = `${label}-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await client.auth.signUp({ email, password });
  if (error || !data.user || !data.session) {
    throw new Error(`Could not create test user: ${error?.message ?? "no session (is autoconfirm on?)"}`);
  }
  return { id: data.user.id, email, password, client };
}

/** Direct database connection as the `postgres` role, for assertions RLS would hide. */
export async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: stack.dbUrl });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

export async function stackIsReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${stack.url}/auth/v1/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
