import "server-only";
import { playerLabel } from "@/lib/domain";
import { describeAlertRule, evaluateAlert, nextAlertState } from "@/lib/finance/alerts";
import { createFormatter } from "@/lib/format";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { throwDb } from "@/lib/actions/runner";
import { toAlert, toObservation, toPlayer, toSettings } from "@/lib/data/mappers";

/**
 * Re-evaluates a player's active alerts against the user's recorded prices and
 * records an alert event for each one whose condition has just become true.
 * Evaluation only ever produces in-app notifications — it never trades.
 * Returns the messages of alerts that fired.
 */
export async function evaluateAlertsForPlayer(
  supabase: TypedSupabaseClient,
  userId: string,
  playerId: string,
): Promise<string[]> {
  const alertsRes = await supabase.from("alerts").select("*").eq("player_id", playerId).eq("is_active", true);
  throwDb(alertsRes.error);
  const alerts = (alertsRes.data ?? []).map(toAlert);
  if (alerts.length === 0) return [];

  const [obsRes, playerRes, settingsRes] = await Promise.all([
    // The longest lookback is 30 days; 400 recent observations is ample for any rule.
    supabase
      .from("price_observations")
      .select("*")
      .eq("player_id", playerId)
      .order("observed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(400),
    supabase.from("players").select("*").eq("id", playerId).single(),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  throwDb(obsRes.error);
  throwDb(playerRes.error);
  throwDb(settingsRes.error);

  const observations = (obsRes.data ?? []).map(toObservation);
  const player = toPlayer(playerRes.data!);
  const settings = toSettings(settingsRes.data, null);
  const fmt = createFormatter({ locale: settings.numberLocale, compact: false, timeZone: settings.timezone });

  const fired: string[] = [];
  for (const alert of alerts) {
    const rule = { type: alert.type, targetValue: alert.targetValue, lookbackHours: alert.lookbackHours, direction: alert.direction };
    const evaluation = evaluateAlert(rule, observations);
    const next = nextAlertState(alert.isTriggered, evaluation);

    if (next.fire && evaluation.status === "satisfied") {
      const detail =
        evaluation.changePercent !== null
          ? ` (${fmt.signedPercent(evaluation.changePercent)} to ${fmt.coins(evaluation.observation.price)})`
          : ` (observed ${fmt.coins(evaluation.observation.price)})`;
      const message = `${playerLabel(player)}: ${describeAlertRule(rule, (n) => fmt.coins(n))}${detail}`.slice(0, 300);
      const insert = await supabase.from("alert_events").insert({
        alert_id: alert.id,
        observation_id: evaluation.observation.id,
        observed_price: evaluation.observation.price,
        message,
      });
      throwDb(insert.error);
      fired.push(message);
    }

    if (next.isTriggered !== alert.isTriggered || next.fire) {
      const update = await supabase
        .from("alerts")
        .update({
          is_triggered: next.isTriggered,
          ...(next.fire ? { last_triggered_at: new Date().toISOString() } : {}),
        })
        .eq("id", alert.id);
      throwDb(update.error);
    }
  }
  return fired;
}
