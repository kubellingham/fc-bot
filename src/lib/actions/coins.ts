"use server";

import { z } from "zod";
import { getPortfolio } from "@/lib/data/queries";
import { roundCoins } from "@/lib/finance";
import { adjustmentSchema, reconcileSchema, uuid } from "@/lib/validation/schemas";
import { runAction, throwDb, UserFacingError } from "./runner";

export async function addAdjustment(raw: unknown) {
  return runAction(adjustmentSchema, raw, { name: "adjustment.create", successMessage: "Coin adjustment recorded." }, async (input, { supabase }) => {
    const { error } = await supabase.from("coin_adjustments").insert({
      amount: input.direction === "credit" ? input.amount : -input.amount,
      reason: input.reason,
      occurred_at: input.occurredAt,
    });
    throwDb(error);
    return null;
  });
}

export async function deleteAdjustment(raw: unknown) {
  return runAction(z.object({ id: uuid }), raw, { name: "adjustment.delete", successMessage: "Adjustment deleted." }, async ({ id }, { supabase }) => {
    const { data, error } = await supabase.from("coin_adjustments").delete().eq("id", id).select("id");
    throwDb(error);
    if (!data?.length) throw new UserFacingError("That adjustment no longer exists.");
    return null;
  });
}

/**
 * Brings the tracked balance in line with the real in-game balance by recording
 * the difference as an adjustment (e.g. coins from rewards or spent on packs).
 */
export async function reconcileBalance(raw: unknown) {
  return runAction(reconcileSchema, raw, { name: "adjustment.reconcile" }, async ({ actualBalance }, { supabase }) => {
    const { summary } = await getPortfolio();
    const difference = roundCoins(actualBalance - summary.availableCoins);
    if (difference === 0) return { difference: 0 };

    const { error } = await supabase.from("coin_adjustments").insert({
      amount: difference,
      reason: "Balance reconciliation with in-game coins",
      occurred_at: new Date().toISOString(),
    });
    throwDb(error);
    return { difference };
  });
}
