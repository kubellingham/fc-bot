import { FinanceInputError, assertWholeCoins, coinsToUnits, percentOf, unitsToCoins } from "./money";
import type { Holding } from "./holdings";
import type { LotSummary } from "./lots";
import type { CoinAdjustment } from "./types";

export interface PortfolioSummary {
  /**
   * Coins not committed to open holdings:
   * starting balance + adjustments − every purchase cost + every sale's net proceeds.
   */
  availableCoins: number;
  /** Purchase cost of all copies still held (capital tied up in cards). */
  investedCost: number;
  /** Gross market value of priced holdings (no tax deducted). */
  holdingsMarketValue: number;
  /**
   * Estimated value of all holdings: after-tax liquidation value for priced holdings,
   * purchase cost for holdings that have never been priced.
   */
  holdingsEstimatedValue: number;
  unpricedHoldings: number;
  unpricedHoldingsCost: number;
  /** Realized P&L from completed sales. */
  realizedProfit: number;
  /** Estimated P&L on priced, unsold holdings (after tax). Unpriced holdings contribute zero. */
  unrealizedProfit: number;
  /** realizedProfit + unrealizedProfit. */
  totalProfit: number;
  realizedRoiPercent: number | null;
  unrealizedRoiPercent: number | null;
  totalRoiPercent: number | null;
  /** availableCoins + holdingsEstimatedValue. */
  portfolioValue: number;
  /** investedCost ÷ (availableCoins + investedCost) × 100. Null when there is no capital. */
  capitalUtilizationPercent: number | null;
  /** True when recorded purchases exceed the coins on record — the starting balance probably needs updating. */
  balanceIsNegative: boolean;
}

export interface PortfolioInput {
  startingBalance: number;
  adjustments: readonly Pick<CoinAdjustment, "amount">[];
  lots: readonly LotSummary[];
  holdings: readonly Holding[];
}

/**
 * Combines lots, holdings and the coin ledger into the headline portfolio metrics.
 *
 * Coins are counted exactly once: a purchase moves coins from "available" into
 * "invested"; a sale moves its net proceeds back into "available" and removes the
 * sold copies' cost from "invested". Realized profit is therefore already inside
 * availableCoins and is never added to portfolio value a second time.
 */
export function computePortfolioSummary({ startingBalance, adjustments, lots, holdings }: PortfolioInput): PortfolioSummary {
  assertWholeCoins(startingBalance, "Starting balance");

  let available = coinsToUnits(startingBalance);
  for (const adj of adjustments) {
    if (!Number.isSafeInteger(adj.amount)) {
      throw new FinanceInputError("Coin adjustments must be whole numbers of coins.");
    }
    available += coinsToUnits(adj.amount);
  }

  let realizedProfit = 0;
  let costOfSold = 0;
  let invested = 0;
  for (const summary of lots) {
    const totalCost = summary.units.costOfSold + summary.units.remainingCost;
    available += summary.units.net - totalCost;
    realizedProfit += summary.units.profit;
    costOfSold += summary.units.costOfSold;
    invested += summary.units.remainingCost;
  }

  let marketValue = 0;
  let estimatedValue = 0;
  let unrealizedProfit = 0;
  let pricedCost = 0;
  let unpricedCount = 0;
  let unpricedCost = 0;
  for (const holding of holdings) {
    if (holding.units.liquidationValue === null || holding.units.marketValue === null) {
      unpricedCount += 1;
      unpricedCost += holding.units.totalCost;
      estimatedValue += holding.units.totalCost;
    } else {
      marketValue += holding.units.marketValue;
      estimatedValue += holding.units.liquidationValue;
      unrealizedProfit += holding.units.liquidationValue - holding.units.totalCost;
      pricedCost += holding.units.totalCost;
    }
  }

  const totalProfit = realizedProfit + unrealizedProfit;
  const capital = available + invested;

  return {
    availableCoins: unitsToCoins(available),
    investedCost: unitsToCoins(invested),
    holdingsMarketValue: unitsToCoins(marketValue),
    holdingsEstimatedValue: unitsToCoins(estimatedValue),
    unpricedHoldings: unpricedCount,
    unpricedHoldingsCost: unitsToCoins(unpricedCost),
    realizedProfit: unitsToCoins(realizedProfit),
    unrealizedProfit: unitsToCoins(unrealizedProfit),
    totalProfit: unitsToCoins(totalProfit),
    realizedRoiPercent: percentOf(realizedProfit, costOfSold),
    unrealizedRoiPercent: percentOf(unrealizedProfit, pricedCost),
    totalRoiPercent: percentOf(totalProfit, costOfSold + pricedCost),
    portfolioValue: unitsToCoins(available + estimatedValue),
    capitalUtilizationPercent: capital > 0 && invested >= 0 ? percentOf(invested, capital) : null,
    balanceIsNegative: available < 0,
  };
}
