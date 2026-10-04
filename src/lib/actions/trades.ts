"use server";

import { z } from "zod";
import { allocateFifo, InsufficientQuantityError, summarizeLots } from "@/lib/finance";
import { fetchAll } from "@/lib/data/fetch-all";
import { toSale, toTrade } from "@/lib/data/mappers";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { saleSchema, tradeSchema, tradeUpdateSchema, uuid } from "@/lib/validation/schemas";
import { runAction, throwDb, UserFacingError } from "./runner";

const PLAYER_MISSING = { "23503": "That player no longer exists." };

/** The tax rate in force for this user (snapshotted onto each sale). */
async function currentTaxRate(supabase: TypedSupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase.from("user_settings").select("tax_rate").eq("user_id", userId).maybeSingle();
  throwDb(error);
  return data ? Number(data.tax_rate) : 0.05;
}

export async function createTrade(raw: unknown) {
  return runAction(tradeSchema, raw, { name: "trade.create", successMessage: "Trade recorded." }, async (input, { supabase, user }) => {
    const { data: trade, error } = await supabase
      .from("trades")
      .insert({
        player_id: input.playerId,
        quantity: input.quantity,
        unit_cost: input.unitCost,
        acquired_at: input.acquiredAt,
        notes: input.notes,
      })
      .select("id")
      .single();
    throwDb(error, PLAYER_MISSING);

    if (input.sold && input.salePrice !== null && input.soldAt !== null) {
      const taxRate = await currentTaxRate(supabase, user.id);
      const sale = await supabase.from("trade_sales").insert({
        trade_id: trade!.id,
        quantity: input.quantity,
        unit_price: input.salePrice,
        tax_rate: taxRate,
        sold_at: input.soldAt,
      });
      if (sale.error) {
        // Keep the two writes all-or-nothing: remove the purchase we just created.
        await supabase.from("trades").delete().eq("id", trade!.id);
        throwDb(sale.error);
      }
    }
    return { id: trade!.id };
  });
}

export async function updateTrade(raw: unknown) {
  return runAction(tradeUpdateSchema, raw, { name: "trade.update", successMessage: "Trade updated." }, async (input, { supabase }) => {
    const { data, error } = await supabase
      .from("trades")
      .update({
        player_id: input.playerId,
        quantity: input.quantity,
        unit_cost: input.unitCost,
        acquired_at: input.acquiredAt,
        notes: input.notes,
      })
      .eq("id", input.id)
      .select("id");
    throwDb(error, PLAYER_MISSING);
    if (!data?.length) throw new UserFacingError("That trade no longer exists.");
    return null;
  });
}

export async function deleteTrade(raw: unknown) {
  return runAction(z.object({ id: uuid }), raw, { name: "trade.delete", successMessage: "Trade deleted." }, async ({ id }, { supabase }) => {
    const { data, error } = await supabase.from("trades").delete().eq("id", id).select("id");
    throwDb(error);
    if (!data?.length) throw new UserFacingError("That trade no longer exists.");
    return null;
  });
}

/**
 * Records a sale. With `tradeId` the copies come from that purchase; with
 * `playerId` they are taken from the player's open purchases oldest-first
 * (FIFO). All rows are inserted in one statement, and a database trigger
 * refuses any row that would oversell a purchase, even under concurrency.
 */
export async function recordSale(raw: unknown) {
  return runAction(saleSchema, raw, { name: "sale.create", successMessage: "Sale recorded." }, async (input, { supabase, user }) => {
    const taxRate = await currentTaxRate(supabase, user.id);

    let allocations: { lotId: string; quantity: number }[];
    if (input.tradeId) {
      allocations = [{ lotId: input.tradeId, quantity: input.quantity }];
    } else {
      const trades = (
        await fetchAll("trades", (from, to) =>
          supabase.from("trades").select("*").eq("player_id", input.playerId!).order("id").range(from, to),
        )
      ).map(toTrade);
      if (trades.length === 0) throw new UserFacingError("You don't hold any copies of this player.");
      const sales = (
        await fetchAll("sales", (from, to) =>
          supabase.from("trade_sales").select("*").in("trade_id", trades.map((t) => t.id)).order("id").range(from, to),
        )
      ).map(toSale);
      const lots = summarizeLots(trades, sales);
      const soldAt = Date.parse(input.soldAt);
      const candidates = lots
        .filter((l) => Date.parse(l.lot.acquiredAt) <= soldAt)
        .map((l) => ({ id: l.lot.id, remainingQuantity: l.remainingQuantity, acquiredAt: l.lot.acquiredAt }));
      try {
        allocations = allocateFifo(candidates, input.quantity);
      } catch (e) {
        if (e instanceof InsufficientQuantityError) {
          throw new UserFacingError(
            e.available === 0
              ? "You held no copies of this player at that sale time."
              : `You held only ${e.available} ${e.available === 1 ? "copy" : "copies"} at that sale time.`,
            { quantity: `At most ${e.available}.` },
          );
        }
        throw e;
      }
    }

    const { error } = await supabase.from("trade_sales").insert(
      allocations.map((a) => ({
        trade_id: a.lotId,
        quantity: a.quantity,
        unit_price: input.unitPrice,
        tax_rate: taxRate,
        sold_at: input.soldAt,
        notes: input.notes,
      })),
    );
    throwDb(error, { "23503": "That purchase no longer exists." });
    return { lots: allocations.length };
  });
}

export async function deleteSale(raw: unknown) {
  return runAction(z.object({ id: uuid }), raw, { name: "sale.delete", successMessage: "Sale deleted." }, async ({ id }, { supabase }) => {
    const { data, error } = await supabase.from("trade_sales").delete().eq("id", id).select("id");
    throwDb(error);
    if (!data?.length) throw new UserFacingError("That sale no longer exists.");
    return null;
  });
}
