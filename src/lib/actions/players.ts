"use server";

import { z } from "zod";
import { playerSchema, uuid } from "@/lib/validation/schemas";
import { runAction, throwDb, UserFacingError } from "./runner";

const DUPLICATE = { "23505": "You already have a player with this name and version." };

export async function createPlayer(raw: unknown) {
  return runAction(playerSchema, raw, { name: "player.create", successMessage: "Player added." }, async (input, { supabase }) => {
    const { data, error } = await supabase.from("players").insert(input).select("id").single();
    throwDb(error, DUPLICATE);
    return { id: data!.id };
  });
}

const updateSchema = z.object({ id: uuid, values: playerSchema });

export async function updatePlayer(raw: unknown) {
  return runAction(updateSchema, raw, { name: "player.update", successMessage: "Player updated." }, async ({ id, values }, { supabase }) => {
    const { data, error } = await supabase.from("players").update(values).eq("id", id).select("id");
    throwDb(error, DUPLICATE);
    if (!data?.length) throw new UserFacingError("That player no longer exists.");
    return null;
  });
}

export async function deletePlayer(raw: unknown) {
  return runAction(z.object({ id: uuid }), raw, { name: "player.delete", successMessage: "Player deleted." }, async ({ id }, { supabase }) => {
    const trades = await supabase.from("trades").select("id", { count: "exact", head: true }).eq("player_id", id);
    throwDb(trades.error);
    if ((trades.count ?? 0) > 0) {
      throw new UserFacingError(
        `This player has ${trades.count} recorded trade${trades.count === 1 ? "" : "s"}. Delete those first to keep your history consistent.`,
      );
    }
    const { data, error } = await supabase.from("players").delete().eq("id", id).select("id");
    throwDb(error, { "23503": "This player still has trades. Delete those first." });
    if (!data?.length) throw new UserFacingError("That player no longer exists.");
    return null;
  });
}
