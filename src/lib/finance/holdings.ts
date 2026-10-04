import { BPS_SCALE, ceilDiv, percentOf, toBps, unitsToCoins } from "./money";
import type { LotSummary } from "./lots";
import type { LatestPrice } from "./types";

export interface Holding {
  playerId: string;
  /** Copies still held across all open lots. */
  quantity: number;
  /** Number of lots (purchases) with copies remaining. */
  openLots: number;
  /** Purchase cost of the copies still held. */
  totalCost: number;
  /** totalCost ÷ quantity. May be fractional when copies were bought at different prices. */
  averageCost: number;
  firstAcquiredAt: string;
  latestPrice: number | null;
  latestObservedAt: string | null;
  /** latestPrice × quantity, before tax. Null when the player has no price observation. */
  marketValue: number | null;
  /** What selling everything at latestPrice would return after tax. */
  liquidationValue: number | null;
  /** liquidationValue − totalCost. */
  unrealizedProfit: number | null;
  unrealizedRoiPercent: number | null;
  /** Lowest whole-coin sale price that recovers the average cost after tax. */
  breakEvenPrice: number;
  units: { totalCost: number; marketValue: number | null; liquidationValue: number | null };
}

/**
 * Aggregates open lots into one holding per player.
 *
 *   Average Cost       = Σ (lot unit cost × remaining copies) ÷ Σ remaining copies
 *   Market Value       = Latest Observed Price × Quantity
 *   Liquidation Value  = Market Value × (1 − Tax Rate)
 *   Unrealized P&L     = Liquidation Value − Remaining Cost
 */
export function buildHoldings(
  lots: readonly LotSummary[],
  latestPrices: ReadonlyMap<string, LatestPrice>,
  taxRate: number,
): Holding[] {
  const bps = toBps(taxRate);
  const groups = new Map<string, LotSummary[]>();
  for (const summary of lots) {
    if (summary.remainingQuantity === 0) continue;
    const list = groups.get(summary.lot.playerId) ?? [];
    list.push(summary);
    groups.set(summary.lot.playerId, list);
  }

  const holdings: Holding[] = [];
  for (const [playerId, playerLots] of groups) {
    const quantity = playerLots.reduce((s, l) => s + l.remainingQuantity, 0);
    const costUnits = playerLots.reduce((s, l) => s + l.units.remainingCost, 0);
    const firstAcquiredAt = playerLots
      .map((l) => l.lot.acquiredAt)
      .reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
    const latest = latestPrices.get(playerId) ?? null;

    let marketUnits: number | null = null;
    let liquidationUnits: number | null = null;
    if (latest) {
      marketUnits = latest.price * quantity * BPS_SCALE;
      liquidationUnits = latest.price * quantity * (BPS_SCALE - bps);
    }
    const profitUnits = liquidationUnits === null ? null : liquidationUnits - costUnits;

    holdings.push({
      playerId,
      quantity,
      openLots: playerLots.length,
      totalCost: unitsToCoins(costUnits),
      averageCost: unitsToCoins(costUnits) / quantity,
      firstAcquiredAt,
      latestPrice: latest?.price ?? null,
      latestObservedAt: latest?.observedAt ?? null,
      marketValue: marketUnits === null ? null : unitsToCoins(marketUnits),
      liquidationValue: liquidationUnits === null ? null : unitsToCoins(liquidationUnits),
      unrealizedProfit: profitUnits === null ? null : unitsToCoins(profitUnits),
      unrealizedRoiPercent: profitUnits === null ? null : percentOf(profitUnits, costUnits),
      breakEvenPrice: ceilDiv(costUnits, quantity * (BPS_SCALE - bps)),
      units: { totalCost: costUnits, marketValue: marketUnits, liquidationValue: liquidationUnits },
    });
  }
  return holdings;
}
