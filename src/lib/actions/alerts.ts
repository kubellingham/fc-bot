"use server";

import { z } from "zod";
import { evaluateAlertsForPlayer } from "@/lib/alerts/evaluate";
import { alertSchema, uuid } from "@/lib/validation/schemas";
import { runAction, throwDb, UserFacingError } from "./runner";

const MAX_ALERTS = 200;

export async function createAlert(raw: unknown) {
  return runAction(alertSchema, raw, { name: "alert.create", successMessage: "Alert created." }, async (input, { supabase, user }) => {
    const { count, error: countError } = await supabase.from("alerts").select("id", { count: "exact", head: true });
    throwDb(countError);
    if ((count ?? 0) >= MAX_ALERTS) throw new UserFacingError(`You can have at most ${MAX_ALERTS} alerts.`);

    const { error } = await supabase.from("alerts").insert({
      player_id: input.playerId,
      alert_type: input.alertType,
      target_value: input.targetValue,
      lookback_hours: input.lookbackHours,
      direction: input.direction,
      note: input.note,
    });
    throwDb(error, { "23503": "That player no longer exists." });
    // If the condition already holds for the latest recorded price, say so now.
    const triggered = await evaluateAlertsForPlayer(supabase, user.id, input.playerId);
    return { triggered };
  });
}

export async function setAlertActive(raw: unknown) {
  return runAction(
    z.object({ id: uuid, active: z.boolean() }),
    raw,
    { name: "alert.toggle" },
    async ({ id, active }, { supabase, user }) => {
      const { data, error } = await supabase
        .from("alerts")
        .update({ is_active: active, ...(active ? {} : { is_triggered: false }) })
        .eq("id", id)
        .select("player_id");
      throwDb(error);
      if (!data?.length) throw new UserFacingError("That alert no longer exists.");
      if (active) await evaluateAlertsForPlayer(supabase, user.id, data[0].player_id);
      return null;
    },
  );
}

export async function deleteAlert(raw: unknown) {
  return runAction(z.object({ id: uuid }), raw, { name: "alert.delete", successMessage: "Alert deleted." }, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("alerts").delete().eq("id", id);
    throwDb(error);
    return null;
  });
}

export async function markAlertEventsRead(raw: unknown) {
  return runAction(
    z.object({ ids: z.array(uuid).max(500).optional() }),
    raw,
    { name: "alert.mark_read" },
    async ({ ids }, { supabase }) => {
      let q = supabase.from("alert_events").update({ read_at: new Date().toISOString() }).is("read_at", null);
      if (ids) q = q.in("id", ids);
      const { error } = await q;
      throwDb(error);
      return null;
    },
  );
}
