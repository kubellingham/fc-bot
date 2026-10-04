import { observationAtOrBefore, sortObservations } from "./prices";
import type { PriceObservation } from "./types";

export const ALERT_TYPES = ["price_below", "price_above", "pct_change"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_DIRECTIONS = ["any", "up", "down"] as const;
export type AlertDirection = (typeof ALERT_DIRECTIONS)[number];

export interface AlertRule {
  type: AlertType;
  /** Coins for price alerts; percentage points for pct_change. */
  targetValue: number;
  /** pct_change only: compare against the latest observation at least this many hours older. Null = previous observation. */
  lookbackHours: number | null;
  /** pct_change only. */
  direction: AlertDirection;
}

export type AlertEvaluation =
  | {
      status: "satisfied" | "not_satisfied";
      observation: PriceObservation;
      baseline: PriceObservation | null;
      changePercent: number | null;
    }
  | { status: "insufficient_data"; reason: string };

/**
 * Evaluates an alert against manually recorded observations (any order).
 *
 * - price_below: latest price ≤ target ("falls to or below")
 * - price_above: latest price ≥ target ("rises to or above")
 * - pct_change:  |change| ≥ target (direction "any"), change ≥ target ("up"),
 *                or change ≤ −target ("down"), where change is measured from a
 *                baseline observation to the latest one.
 */
export function evaluateAlert(rule: AlertRule, observations: readonly PriceObservation[]): AlertEvaluation {
  if (observations.length === 0) {
    return { status: "insufficient_data", reason: "No price observations recorded yet." };
  }
  const sorted = sortObservations(observations);
  const latest = sorted[sorted.length - 1];

  if (rule.type === "price_below" || rule.type === "price_above") {
    const satisfied = rule.type === "price_below" ? latest.price <= rule.targetValue : latest.price >= rule.targetValue;
    return { status: satisfied ? "satisfied" : "not_satisfied", observation: latest, baseline: null, changePercent: null };
  }

  let baseline: PriceObservation | null;
  if (rule.lookbackHours === null) {
    baseline = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  } else {
    baseline = observationAtOrBefore(sorted, Date.parse(latest.observedAt) - rule.lookbackHours * 3_600_000);
    if (baseline === latest) baseline = null;
  }
  if (!baseline) {
    return {
      status: "insufficient_data",
      reason:
        rule.lookbackHours === null
          ? "Needs at least two price observations."
          : `Needs an observation at least ${rule.lookbackHours}h before the latest one.`,
    };
  }

  const changePercent = ((latest.price - baseline.price) / baseline.price) * 100;
  const satisfied =
    rule.direction === "up"
      ? changePercent >= rule.targetValue
      : rule.direction === "down"
        ? changePercent <= -rule.targetValue
        : Math.abs(changePercent) >= rule.targetValue;
  return { status: satisfied ? "satisfied" : "not_satisfied", observation: latest, baseline, changePercent };
}

/**
 * Edge-triggered state machine: an alert fires once when its condition becomes
 * true and re-arms once the condition is no longer true. Missing data leaves the
 * state unchanged.
 */
export function nextAlertState(wasTriggered: boolean, evaluation: AlertEvaluation): { fire: boolean; isTriggered: boolean } {
  switch (evaluation.status) {
    case "satisfied":
      return { fire: !wasTriggered, isTriggered: true };
    case "not_satisfied":
      return { fire: false, isTriggered: false };
    case "insufficient_data":
      return { fire: false, isTriggered: wasTriggered };
  }
}

export function describeAlertRule(rule: AlertRule, formatCoins: (n: number) => string): string {
  switch (rule.type) {
    case "price_below":
      return `Price at or below ${formatCoins(rule.targetValue)}`;
    case "price_above":
      return `Price at or above ${formatCoins(rule.targetValue)}`;
    case "pct_change": {
      const dir = rule.direction === "up" ? "rises" : rule.direction === "down" ? "falls" : "moves";
      const window = rule.lookbackHours === null ? "since the previous observation" : `over ${formatLookback(rule.lookbackHours)}`;
      return `Price ${dir} ${rule.targetValue}% or more ${window}`;
    }
  }
}

export function formatLookback(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "24 hours" : `${days} days`;
  }
  return `${hours} hours`;
}
