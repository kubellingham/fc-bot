/**
 * Fixed-point helpers shared by every financial calculation.
 *
 * Every coin amount a user enters (prices, costs, balances) is a whole number
 * of coins, and tax rates have at most four decimal places (e.g. 0.0500). If we
 * express amounts in "units" of 1/10,000 of a coin and the tax rate in basis
 * points (1/10,000), every intermediate value — gross proceeds, tax, net
 * proceeds, profit — is an exact integer. We therefore never accumulate
 * floating-point error while summing many trades, and the sign of a profit
 * (win / loss / break-even) is always decided exactly.
 *
 * Values are converted back to coins (which may then carry a fractional part,
 * e.g. a 7.5 coin tax) only at the boundary of the module. Rounding happens
 * only when values are displayed.
 */

export const UNITS_PER_COIN = 10_000;
export const BPS_SCALE = 10_000;

/** EA's Transfer Market tax. Configurable per user; this is the default. */
export const DEFAULT_TAX_RATE = 0.05;

/** Highest Buy Now price allowed on the FC Transfer Market. Used as a sanity bound. */
export const MAX_UNIT_PRICE = 15_000_000;
export const MAX_QUANTITY = 10_000;
/** Upper bound for balances / adjustments (10 billion coins) — a sanity guard, not a game rule. */
export const MAX_COIN_BALANCE = 10_000_000_000;

export class FinanceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceInputError";
  }
}

export function assertWholeCoins(value: number, label: string, { min = 0 }: { min?: number } = {}): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new FinanceInputError(`${label} must be a number.`);
  }
  if (!Number.isInteger(value)) {
    throw new FinanceInputError(`${label} must be a whole number of coins.`);
  }
  if (value < min) {
    throw new FinanceInputError(min === 0 ? `${label} cannot be negative.` : `${label} must be at least ${min}.`);
  }
  if (!Number.isSafeInteger(value * UNITS_PER_COIN)) {
    throw new FinanceInputError(`${label} is too large.`);
  }
}

export function assertQuantity(value: number, label = "Quantity"): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new FinanceInputError(`${label} must be a positive whole number.`);
  }
  if (value > MAX_QUANTITY) {
    throw new FinanceInputError(`${label} cannot exceed ${MAX_QUANTITY}.`);
  }
}

/** Converts a decimal tax rate (0.05) to basis points (500), validating its range. */
export function toBps(rate: number): number {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate >= 1) {
    throw new FinanceInputError("Tax rate must be at least 0 and below 1 (e.g. 0.05 for 5%).");
  }
  const bps = Math.round(rate * BPS_SCALE);
  if (Math.abs(bps - rate * BPS_SCALE) > 1e-6) {
    throw new FinanceInputError("Tax rate supports at most four decimal places.");
  }
  return bps;
}

export const coinsToUnits = (coins: number): number => coins * UNITS_PER_COIN;
export const unitsToCoins = (units: number): number => units / UNITS_PER_COIN;

/** Returns `numerator / denominator × 100`, or null when the denominator is zero (e.g. ROI on a free pack pull). */
export function percentOf(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return (numerator * 100) / denominator;
}

/** Ceil of a / b for non-negative safe integers a and positive integer b. */
export function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

/** Rounds a coin amount for display or persistence. Uses half-away-from-zero, matching Intl's default. */
export function roundCoins(value: number): number {
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return rounded === 0 ? 0 : rounded; // avoid -0
}
