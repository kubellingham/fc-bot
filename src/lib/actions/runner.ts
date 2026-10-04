import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import type { z } from "zod";
import { getAuth, type AuthContext } from "@/lib/data/auth";
import { ConfigurationError } from "@/lib/env";
import { FinanceInputError } from "@/lib/finance/money";
import { errorFields, logger } from "@/lib/logger";
import type { ActionResult } from "./result";

/** An expected failure whose message is safe to show to the user. */
export class UserFacingError extends Error {
  constructor(message: string, public readonly fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "UserFacingError";
  }
}

/**
 * Converts a PostgREST/Postgres error into a safe, helpful message.
 * Our own trigger messages (constraint names starting with trade/trades_) are
 * written for users and passed through; everything else is generic.
 */
export function describeDbError(error: PostgrestError, messages: Partial<Record<string, string>> = {}): string {
  const custom = messages[error.code];
  if (custom) return custom;
  switch (error.code) {
    case "23505":
      return "A matching record already exists.";
    case "23503":
      return "This record is linked to other data and cannot be changed that way.";
    case "23514":
      if (/^(Cannot sell|A sale cannot|Quantity cannot|Purchase date cannot)/.test(error.message)) return error.message;
      return "Some values are outside the allowed range.";
    case "42501":
      return "You don't have permission to do that.";
    case "PGRST116":
      return "That record no longer exists.";
    default:
      return "Something went wrong while saving. Please try again.";
  }
}

export function throwDb(error: PostgrestError | null, messages?: Partial<Record<string, string>>): void {
  if (error) throw new DbError(error, messages);
}

class DbError extends Error {
  constructor(public readonly pg: PostgrestError, public readonly messages?: Partial<Record<string, string>>) {
    super(pg.message);
    this.name = "DbError";
  }
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

interface RunOptions {
  /** Event name for logs, e.g. "trade.create". */
  name: string;
  successMessage?: string;
  /** Re-render the current route after a successful mutation (default true). */
  refresh?: boolean;
}

/**
 * Validates input with `schema`, verifies the session, runs `handler`, and maps
 * every failure to a safe ActionResult. The handler receives a Supabase client
 * bound to the user, so RLS is enforced on every query it makes.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  raw: unknown,
  options: RunOptions,
  handler: (input: z.output<S>, ctx: AuthContext) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  let auth: AuthContext | null;
  try {
    auth = await getAuth();
  } catch (error) {
    logger.error(`${options.name}.auth_failed`, errorFields(error));
    return { ok: false, error: "We couldn't verify your session. Please try again." };
  }
  if (!auth) return { ok: false, error: "Your session has expired. Please sign in again." };

  try {
    const data = await handler(parsed.data, auth);
    if (options.refresh !== false) refresh();
    return { ok: true, data, message: options.successMessage };
  } catch (error) {
    if (error instanceof UserFacingError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    if (error instanceof FinanceInputError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof DbError) {
      logger.warn(`${options.name}.db_error`, { userId: auth.user.id, errorCode: error.pg.code });
      return { ok: false, error: describeDbError(error.pg, error.messages) };
    }
    if (error instanceof ConfigurationError) {
      logger.error(`${options.name}.misconfigured`, {});
      return { ok: false, error: "This feature is not configured on the server." };
    }
    logger.error(`${options.name}.failed`, { userId: auth.user.id, ...errorFields(error) });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
