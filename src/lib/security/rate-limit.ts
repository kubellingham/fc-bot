import "server-only";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export type RateBucket = "ai_short" | "ai_daily" | "import";

export const RATE_LIMITS: Record<RateBucket, { limit: number; windowSeconds: number; message: string }> = {
  ai_short: { limit: 8, windowSeconds: 600, message: "You've made several AI requests in a short time. Please wait a few minutes." },
  ai_daily: { limit: 40, windowSeconds: 86_400, message: "You've reached today's AI request limit. It resets within 24 hours." },
  import: { limit: 20, windowSeconds: 3_600, message: "Too many imports in the last hour. Please wait before importing again." },
};

/**
 * Consumes one unit from a per-user, database-backed fixed window, so limits
 * hold across serverless instances. Returns an error message when exceeded.
 * Fails closed: if the check itself errors, the request is refused.
 */
export async function checkRateLimit(supabase: TypedSupabaseClient, buckets: RateBucket[]): Promise<string | null> {
  for (const bucket of buckets) {
    const { limit, windowSeconds, message } = RATE_LIMITS[bucket];
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      logger.error("rate_limit.check_failed", { bucket, errorCode: error.code });
      return "Couldn't verify request limits. Please try again.";
    }
    if (data === false) return message;
  }
  return null;
}
