"use server";

import { redirect } from "next/navigation";
import { getAuth } from "@/lib/data/auth";
import { errorFields, logger } from "@/lib/logger";
import { deleteAccountSchema, settingsSchema, themeSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "./result";
import { runAction, throwDb } from "./runner";

export async function updateSettings(raw: unknown) {
  return runAction(settingsSchema, raw, { name: "settings.update", successMessage: "Settings saved." }, async (input, { supabase, user }) => {
    const [settings, profile] = await Promise.all([
      supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          starting_coin_balance: input.startingCoinBalance,
          tax_rate: Math.round(input.taxRatePercent * 100) / 10_000,
          number_locale: input.numberLocale,
          compact_numbers: input.compactNumbers,
          theme: input.theme,
          timezone: input.timezone,
          alert_notifications: input.alertNotifications,
        },
        { onConflict: "user_id" },
      ),
      supabase.from("profiles").upsert({ id: user.id, display_name: input.displayName }, { onConflict: "id" }),
    ]);
    throwDb(settings.error);
    throwDb(profile.error);
    return null;
  });
}

export async function updateTheme(raw: unknown) {
  return runAction(themeSchema, raw, { name: "settings.theme", refresh: false }, async (theme, { supabase, user }) => {
    const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, theme }, { onConflict: "user_id" });
    throwDb(error);
    return null;
  });
}

/**
 * Permanently deletes the account. The database function removes the caller's
 * auth user, and every table cascades from it.
 */
export async function deleteAccount(raw: unknown): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Type "DELETE" to confirm.', fieldErrors: { confirmation: 'Type "DELETE" to confirm.' } };

  const auth = await getAuth();
  if (!auth) return { ok: false, error: "Your session has expired. Please sign in again." };

  const { error } = await auth.supabase.rpc("delete_my_account");
  if (error) {
    logger.error("account.delete_failed", { userId: auth.user.id, ...errorFields(error) });
    return { ok: false, error: "We couldn't delete your account. Please try again or contact support." };
  }
  logger.info("account.deleted", { userId: auth.user.id });
  await auth.supabase.auth.signOut().catch(() => undefined);
  redirect("/?deleted=1");
}
