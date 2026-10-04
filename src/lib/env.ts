import { z } from "zod";

/**
 * Environment configuration, validated on first use (not at import time, so a
 * missing optional integration never breaks the build).
 *
 * Only NEXT_PUBLIC_* values are ever sent to the browser. The Supabase
 * publishable/anon key is designed to be public: all access is enforced by RLS.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY looks invalid"),
});

const aiSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  ANTHROPIC_MODEL: z.string().min(3).max(100).optional(),
});

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function readPublic() {
  return publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Accept the legacy name for projects that still use the anon JWT key.
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function isSupabaseConfigured(): boolean {
  return readPublic().success;
}

export function getSupabaseEnv(): { url: string; publishableKey: string } {
  const parsed = readPublic();
  if (!parsed.success) {
    throw new ConfigurationError(
      `Supabase is not configured: ${parsed.error.issues.map((i) => i.message).join("; ")}. See .env.example.`,
    );
  }
  return { url: parsed.data.NEXT_PUBLIC_SUPABASE_URL, publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}

/** Default model for the AI analyst; override with ANTHROPIC_MODEL. */
export const DEFAULT_AI_MODEL = "claude-sonnet-5-5";

export function getAiEnv(): { apiKey: string; model: string } | null {
  const parsed = aiSchema.safeParse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || undefined,
  });
  if (!parsed.success || !parsed.data.ANTHROPIC_API_KEY) return null;
  return { apiKey: parsed.data.ANTHROPIC_API_KEY, model: parsed.data.ANTHROPIC_MODEL ?? DEFAULT_AI_MODEL };
}
