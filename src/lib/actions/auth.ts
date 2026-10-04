"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { errorFields, logger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/security/redirect";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/schemas";
import type { ActionResult } from "./result";
import type { z } from "zod";

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".") || "_form"] ??= i.message;
  return out;
}

const NOT_CONFIGURED: ActionResult<never> = {
  ok: false,
  error: "Sign-in is unavailable: Supabase is not configured on this server.",
};

/** Absolute origin for links in auth emails. Prefers the configured site URL. */
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && /^https?:\/\//.test(configured)) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(raw: unknown, next?: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // One generic message for unknown email, wrong password and unconfirmed accounts
    // avoids revealing which addresses are registered.
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "Please confirm your email address first — check your inbox for the link." };
    }
    if (error.status === 429) return { ok: false, error: "Too many attempts. Please wait a minute and try again." };
    if (error.status && error.status >= 500) {
      logger.error("auth.sign_in_failed", errorFields(error));
      return { ok: false, error: "The sign-in service is unavailable. Please try again shortly." };
    }
    return { ok: false, error: "Incorrect email or password." };
  }
  redirect(safeRedirectPath(next));
}

export async function signUp(raw: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/dashboard` },
  });
  if (error) {
    if (error.code === "weak_password") return { ok: false, error: "That password is too weak. Try a longer passphrase." };
    if (error.status === 429) return { ok: false, error: "Too many sign-up attempts. Please wait and try again." };
    if (error.code === "user_already_exists") {
      // Only reached when email confirmation is disabled; still avoid confirming the address exists.
      return { ok: true, data: { needsConfirmation: true }, message: "Check your email to continue." };
    }
    logger.error("auth.sign_up_failed", errorFields(error));
    return { ok: false, error: "We couldn't create your account. Please try again." };
  }
  if (data.session) redirect("/dashboard");
  return { ok: true, data: { needsConfirmation: true }, message: "Check your email to confirm your account." };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function requestPasswordReset(raw: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error && error.status !== 429) logger.warn("auth.reset_request_failed", errorFields(error));
  // Same response whether or not the account exists.
  return {
    ok: true,
    data: null,
    message: "If an account exists for that address, a reset link is on its way.",
  };
}

export async function updatePassword(raw: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { ok: false, error: "Choose a password you haven't used here before." };
    if (error.code === "weak_password") return { ok: false, error: "That password is too weak." };
    logger.error("auth.update_password_failed", errorFields(error));
    return { ok: false, error: "We couldn't update your password. Please try again." };
  }
  redirect("/dashboard");
}
