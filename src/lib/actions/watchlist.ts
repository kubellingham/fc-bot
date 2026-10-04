"use server";

import { z } from "zod";
import { uuid, watchlistSchema } from "@/lib/validation/schemas";
import { runAction, throwDb, UserFacingError } from "./runner";

/** Adds a player to the watchlist, or updates its targets if already watched. */
export async function saveWatchlistItem(raw: unknown) {
  return runAction(watchlistSchema, raw, { name: "watchlist.save", successMessage: "Watchlist updated." }, async (input, { supabase }) => {
    const { error } = await supabase.from("watchlist_items").upsert(
      {
        player_id: input.playerId,
        target_buy_price: input.targetBuyPrice,
        target_sell_price: input.targetSellPrice,
        notes: input.notes,
        archived_at: null,
      },
      { onConflict: "user_id,player_id" },
    );
    throwDb(error, { "23503": "That player no longer exists." });
    return null;
  });
}

export async function setWatchlistArchived(raw: unknown) {
  return runAction(
    z.object({ id: uuid, archived: z.boolean() }),
    raw,
    { name: "watchlist.archive" },
    async ({ id, archived }, { supabase }) => {
      const { data, error } = await supabase
        .from("watchlist_items")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id)
        .select("id");
      throwDb(error);
      if (!data?.length) throw new UserFacingError("That watchlist entry no longer exists.");
      return null;
    },
  );
}

export async function removeWatchlistItem(raw: unknown) {
  return runAction(z.object({ id: uuid }), raw, { name: "watchlist.remove", successMessage: "Removed from watchlist." }, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("watchlist_items").delete().eq("id", id);
    throwDb(error);
    return null;
  });
}
