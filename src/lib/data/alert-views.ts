import "server-only";
import { playerLabel, type Alert, type Observation, type Player } from "@/lib/domain";
import { evaluateAlert } from "@/lib/finance/alerts";

export interface AlertRow {
  id: string;
  playerId: string;
  label: string;
  type: Alert["type"];
  targetValue: number;
  lookbackHours: number | null;
  direction: Alert["direction"];
  isActive: boolean;
  isTriggered: boolean;
  lastTriggeredAt: string | null;
  note: string | null;
  /** Current state against the latest recorded prices. */
  status: "satisfied" | "not_satisfied" | "insufficient_data";
  latestPrice: number | null;
  changePercent: number | null;
  reason: string | null;
}

export function alertRows(alerts: Alert[], players: Map<string, Player>, observations: Observation[]): AlertRow[] {
  const byPlayer = new Map<string, Observation[]>();
  for (const o of observations) {
    const list = byPlayer.get(o.playerId) ?? [];
    list.push(o);
    byPlayer.set(o.playerId, list);
  }
  return alerts.map((a) => {
    const player = players.get(a.playerId);
    const evaluation = evaluateAlert(
      { type: a.type, targetValue: a.targetValue, lookbackHours: a.lookbackHours, direction: a.direction },
      byPlayer.get(a.playerId) ?? [],
    );
    return {
      id: a.id,
      playerId: a.playerId,
      label: player ? playerLabel(player) : "Unknown player",
      type: a.type,
      targetValue: a.targetValue,
      lookbackHours: a.lookbackHours,
      direction: a.direction,
      isActive: a.isActive,
      isTriggered: a.isTriggered,
      lastTriggeredAt: a.lastTriggeredAt,
      note: a.note,
      status: evaluation.status,
      latestPrice: evaluation.status === "insufficient_data" ? null : evaluation.observation.price,
      changePercent: evaluation.status === "insufficient_data" ? null : evaluation.changePercent,
      reason: evaluation.status === "insufficient_data" ? evaluation.reason : null,
    };
  });
}
