"use server";

import { z } from "zod";
import { evaluateAlertsForPlayer } from "@/lib/alerts/evaluate";
import { observationSchema, uuid } from "@/lib/validation/schemas";
import { runAction, throwDb, UserFacingError } from "./runner";

/** Records a price the user saw in game, then evaluates that player's alerts. */
export async function recordObservation(raw: unknown) {
  return runAction(observationSchema, raw, { name: "observation.create", successMessage: "Price recorded." }, async (input, { supabase, user }) => {
    const { error } = await supabase.from("price_observations").insert({
      player_id: input.playerId,
      price: input.price,
      observed_at: input.observedAt,
      notes: input.notes,
      source: "manual",
    });
    throwDb(error, { "23503": "That player no longer exists." });
    const triggered = await evaluateAlertsForPlayer(supabase, user.id, input.playerId);
    return { triggered };
  });
}

export async function deleteObservation(raw: unknown) {
  return runAction(z.object({ id: uuid }), raw, { name: "observation.delete", successMessage: "Price deleted." }, async ({ id }, { supabase, user }) => {
    const { data, error } = await supabase.from("price_observations").delete().eq("id", id).select("player_id");
    throwDb(error);
    if (!data?.length) throw new UserFacingError("That price no longer exists.");
    // Alert state depends on the latest price, which may have changed.
    await evaluateAlertsForPlayer(supabase, user.id, data[0].player_id);
    return null;
  });
}
