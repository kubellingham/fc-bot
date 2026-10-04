import { daysBetween } from "./dates";
import type { LatestPrice, PriceObservation } from "./types";

const HOUR_MS = 3_600_000;

type Orderable = Pick<PriceObservation, "observedAt" | "id" | "createdAt">;

/** Chronological order: observation time, then recording time, then id (fully deterministic). */
export function compareObservations(a: Orderable, b: Orderable): number {
  return (
    Date.parse(a.observedAt) - Date.parse(b.observedAt) ||
    (a.createdAt && b.createdAt ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : 0) ||
    a.id.localeCompare(b.id)
  );
}

/** Returns a new array sorted oldest → newest. */
export function sortObservations<T extends Orderable>(observations: readonly T[]): T[] {
  return [...observations].sort(compareObservations);
}

/** Latest observation per player. Input order does not matter. */
export function latestPricesByPlayer(observations: readonly PriceObservation[]): Map<string, LatestPrice> {
  const latest = new Map<string, PriceObservation>();
  for (const obs of observations) {
    const current = latest.get(obs.playerId);
    if (!current || compareObservations(obs, current) > 0) latest.set(obs.playerId, obs);
  }
  return new Map([...latest].map(([playerId, { price, observedAt }]) => [playerId, { price, observedAt }]));
}

/** The most recent observation at or before `instant` in an ascending-sorted list. */
export function observationAtOrBefore<T extends Pick<PriceObservation, "observedAt">>(
  sortedAsc: readonly T[],
  instant: number,
): T | null {
  let lo = 0;
  let hi = sortedAsc.length - 1;
  let found: T | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (Date.parse(sortedAsc[mid].observedAt) <= instant) {
      found = sortedAsc[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export interface PriceChange {
  fromPrice: number;
  toPrice: number;
  fromObservedAt: string;
  toObservedAt: string;
  absoluteChange: number;
  percentChange: number;
}

/**
 * Change between the latest observation and the most recent observation at least
 * `windowHours` older than it. Measured relative to the latest observation (not
 * "now"), so the figure stays meaningful when prices are recorded sporadically;
 * callers show the observation's age separately.
 *
 * Returns null when there is no observation old enough to compare against.
 */
export function priceChangeOverWindow(sortedAsc: readonly PriceObservation[], windowHours: number): PriceChange | null {
  if (sortedAsc.length < 2) return null;
  const latest = sortedAsc[sortedAsc.length - 1];
  const baseline = observationAtOrBefore(sortedAsc, Date.parse(latest.observedAt) - windowHours * HOUR_MS);
  if (!baseline || baseline === latest) return null;
  return describeChange(baseline, latest);
}

/** Change between the latest observation and the one immediately before it. */
export function priceChangeSincePrevious(sortedAsc: readonly PriceObservation[]): PriceChange | null {
  if (sortedAsc.length < 2) return null;
  return describeChange(sortedAsc[sortedAsc.length - 2], sortedAsc[sortedAsc.length - 1]);
}

function describeChange(from: PriceObservation, to: PriceObservation): PriceChange {
  const absoluteChange = to.price - from.price;
  return {
    fromPrice: from.price,
    toPrice: to.price,
    fromObservedAt: from.observedAt,
    toObservedAt: to.observedAt,
    absoluteChange,
    percentChange: (absoluteChange / from.price) * 100,
  };
}

export interface PriceStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  /** Population standard deviation ÷ mean × 100. Null with fewer than two observations. */
  volatilityPercent: number | null;
  firstObservedAt: string;
  lastObservedAt: string;
}

export function priceStats(observations: readonly PriceObservation[]): PriceStats | null {
  if (observations.length === 0) return null;
  const sorted = sortObservations(observations);
  const prices = sorted.map((o) => o.price);
  const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
  const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length;
  return {
    count: prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    mean,
    volatilityPercent: prices.length < 2 ? null : (Math.sqrt(variance) / mean) * 100,
    firstObservedAt: sorted[0].observedAt,
    lastObservedAt: sorted[sorted.length - 1].observedAt,
  };
}

export interface Trend {
  /** Least-squares slope expressed as % of the mean price per day. */
  percentPerDay: number;
  direction: "rising" | "falling" | "flat";
  /** Coefficient of determination of the linear fit, 0–1. */
  rSquared: number;
  observations: number;
  spanDays: number;
}

/**
 * Linear-regression trend over the supplied observations. Requires at least
 * three observations spanning at least one day; otherwise returns null rather
 * than over-interpreting noise. A slope below ±0.5% per day is "flat".
 */
export function priceTrend(observations: readonly PriceObservation[], flatThresholdPercent = 0.5): Trend | null {
  if (observations.length < 3) return null;
  const sorted = sortObservations(observations);
  const t0 = sorted[0].observedAt;
  const xs = sorted.map((o) => daysBetween(t0, o.observedAt));
  const ys = sorted.map((o) => o.price);
  const spanDays = xs[xs.length - 1];
  if (spanDays < 1) return null;

  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
    sxx += (xs[i] - meanX) ** 2;
    syy += (ys[i] - meanY) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const percentPerDay = (slope / meanY) * 100;
  const rSquared = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  const direction =
    Math.abs(percentPerDay) < flatThresholdPercent ? "flat" : percentPerDay > 0 ? "rising" : "falling";
  return { percentPerDay, direction, rSquared, observations: n, spanDays };
}

export interface PriceJump {
  from: PriceObservation;
  to: PriceObservation;
  percentChange: number;
}

/** Consecutive observations whose price moved by at least `thresholdPercent` (default 20%). */
export function detectPriceJumps(observations: readonly PriceObservation[], thresholdPercent = 20): PriceJump[] {
  const sorted = sortObservations(observations);
  const jumps: PriceJump[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const pct = ((sorted[i].price - sorted[i - 1].price) / sorted[i - 1].price) * 100;
    if (Math.abs(pct) >= thresholdPercent) {
      jumps.push({ from: sorted[i - 1], to: sorted[i], percentChange: pct });
    }
  }
  return jumps;
}
