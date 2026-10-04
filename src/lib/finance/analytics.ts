import { enumeratePeriods, periodKey, type Granularity } from "./dates";
import { BPS_SCALE, coinsToUnits, percentOf, toBps, unitsToCoins } from "./money";
import { sortObservations } from "./prices";
import { saleProceedsUnits } from "./tax";
import type { CoinAdjustment, LotRecord, PriceObservation, SaleRecord } from "./types";
import type { LotSummary } from "./lots";

/** One sale matched to the lot it came from — the unit of "a completed trade" for analytics. */
export interface RealizedTrade {
  saleId: string;
  tradeId: string;
  playerId: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  taxRate: number;
  grossProceeds: number;
  tax: number;
  netProceeds: number;
  costBasis: number;
  profit: number;
  roiPercent: number | null;
  acquiredAt: string;
  soldAt: string;
  holdingHours: number;
  units: { cost: number; net: number; tax: number; profit: number };
}

export function realizedTrades(lots: readonly LotSummary[]): RealizedTrade[] {
  const trades: RealizedTrade[] = [];
  for (const { lot, sales } of lots) {
    for (const sale of sales) {
      const proceeds = saleProceedsUnits(sale.unitPrice, sale.quantity, sale.taxRate);
      const cost = lot.unitCost * sale.quantity * BPS_SCALE;
      const profit = proceeds.net - cost;
      trades.push({
        saleId: sale.id,
        tradeId: lot.id,
        playerId: lot.playerId,
        quantity: sale.quantity,
        unitCost: lot.unitCost,
        unitPrice: sale.unitPrice,
        taxRate: sale.taxRate,
        grossProceeds: unitsToCoins(proceeds.gross),
        tax: unitsToCoins(proceeds.tax),
        netProceeds: unitsToCoins(proceeds.net),
        costBasis: unitsToCoins(cost),
        profit: unitsToCoins(profit),
        roiPercent: percentOf(profit, cost),
        acquiredAt: lot.acquiredAt,
        soldAt: sale.soldAt,
        holdingHours: Math.max(0, (Date.parse(sale.soldAt) - Date.parse(lot.acquiredAt)) / 3_600_000),
        units: { cost, net: proceeds.net, tax: proceeds.tax, profit },
      });
    }
  }
  return trades.sort((a, b) => Date.parse(a.soldAt) - Date.parse(b.soldAt) || a.saleId.localeCompare(b.saleId));
}

export function tradesSoldBetween(trades: readonly RealizedTrade[], from: Date | null, to: Date = new Date()): RealizedTrade[] {
  const start = from?.getTime() ?? -Infinity;
  const end = to.getTime();
  return trades.filter((t) => {
    const at = Date.parse(t.soldAt);
    return at >= start && at <= end;
  });
}

export interface TradeStats {
  /** Number of realized trades (sales). */
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  /** wins ÷ count × 100. Break-even trades count as non-wins. */
  winRatePercent: number | null;
  totalProfit: number;
  totalCostBasis: number;
  totalNetProceeds: number;
  totalTax: number;
  /** totalProfit ÷ count. */
  averageProfit: number | null;
  /** totalProfit ÷ totalCostBasis × 100. */
  roiPercent: number | null;
  /** Holding time weighted by quantity: Σ(hours × qty) ÷ Σ qty. */
  averageHoldingHours: number | null;
  unitsSold: number;
}

export function tradeStats(trades: readonly RealizedTrade[]): TradeStats {
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let profit = 0;
  let cost = 0;
  let net = 0;
  let tax = 0;
  let weightedHours = 0;
  let unitsSold = 0;
  for (const t of trades) {
    if (t.units.profit > 0) wins += 1;
    else if (t.units.profit < 0) losses += 1;
    else breakeven += 1;
    profit += t.units.profit;
    cost += t.units.cost;
    net += t.units.net;
    tax += t.units.tax;
    weightedHours += t.holdingHours * t.quantity;
    unitsSold += t.quantity;
  }
  const count = trades.length;
  return {
    count,
    wins,
    losses,
    breakeven,
    winRatePercent: percentOf(wins, count),
    totalProfit: unitsToCoins(profit),
    totalCostBasis: unitsToCoins(cost),
    totalNetProceeds: unitsToCoins(net),
    totalTax: unitsToCoins(tax),
    averageProfit: count === 0 ? null : unitsToCoins(profit) / count,
    roiPercent: percentOf(profit, cost),
    averageHoldingHours: unitsSold === 0 ? null : weightedHours / unitsSold,
    unitsSold,
  };
}

export interface PeriodProfit {
  key: string;
  profit: number;
  trades: number;
  wins: number;
}

/** Realized profit per day / week / month in the user's time zone, with empty periods filled with zero. */
export function profitByPeriod(
  trades: readonly RealizedTrade[],
  granularity: Granularity,
  timeZone: string,
  range: { start: Date | string; end: Date | string },
): PeriodProfit[] {
  const buckets = new Map<string, { profit: number; trades: number; wins: number }>();
  for (const key of enumeratePeriods(range.start, range.end, granularity, timeZone)) {
    buckets.set(key, { profit: 0, trades: 0, wins: 0 });
  }
  for (const t of trades) {
    const bucket = buckets.get(periodKey(t.soldAt, granularity, timeZone));
    if (!bucket) continue; // outside the requested range
    bucket.profit += t.units.profit;
    bucket.trades += 1;
    if (t.units.profit > 0) bucket.wins += 1;
  }
  return [...buckets].map(([key, b]) => ({ key, profit: unitsToCoins(b.profit), trades: b.trades, wins: b.wins }));
}

export interface CumulativePoint {
  key: string;
  profit: number;
  cumulativeProfit: number;
  /** cumulativeProfit ÷ cumulative cost basis of sold copies × 100. */
  cumulativeRoiPercent: number | null;
}

/** Running realized P&L by day. Profit realized before the range is carried in as the opening value. */
export function cumulativeProfitByDay(
  trades: readonly RealizedTrade[],
  timeZone: string,
  range: { start: Date | string; end: Date | string },
): CumulativePoint[] {
  const firstKey = periodKey(range.start, "day", timeZone);
  let runningProfit = 0;
  let runningCost = 0;
  const daily = new Map<string, { profit: number; cost: number }>();
  for (const key of enumeratePeriods(range.start, range.end, "day", timeZone)) daily.set(key, { profit: 0, cost: 0 });

  for (const t of trades) {
    const key = periodKey(t.soldAt, "day", timeZone);
    if (key < firstKey) {
      runningProfit += t.units.profit;
      runningCost += t.units.cost;
      continue;
    }
    const bucket = daily.get(key);
    if (!bucket) continue;
    bucket.profit += t.units.profit;
    bucket.cost += t.units.cost;
  }

  return [...daily].map(([key, b]) => {
    runningProfit += b.profit;
    runningCost += b.cost;
    return {
      key,
      profit: unitsToCoins(b.profit),
      cumulativeProfit: unitsToCoins(runningProfit),
      cumulativeRoiPercent: percentOf(runningProfit, runningCost),
    };
  });
}

export interface PlayerPerformance {
  playerId: string;
  trades: number;
  unitsSold: number;
  profit: number;
  costBasis: number;
  roiPercent: number | null;
}

/** Realized performance per player, best first. */
export function playerPerformance(trades: readonly RealizedTrade[]): PlayerPerformance[] {
  const byPlayer = new Map<string, { trades: number; units: number; profit: number; cost: number }>();
  for (const t of trades) {
    const p = byPlayer.get(t.playerId) ?? { trades: 0, units: 0, profit: 0, cost: 0 };
    p.trades += 1;
    p.units += t.quantity;
    p.profit += t.units.profit;
    p.cost += t.units.cost;
    byPlayer.set(t.playerId, p);
  }
  return [...byPlayer]
    .map(([playerId, p]) => ({
      playerId,
      trades: p.trades,
      unitsSold: p.units,
      profit: unitsToCoins(p.profit),
      costBasis: unitsToCoins(p.cost),
      roiPercent: percentOf(p.profit, p.cost),
    }))
    .sort((a, b) => b.profit - a.profit || a.playerId.localeCompare(b.playerId));
}

export interface PortfolioValuePoint {
  key: string;
  availableCoins: number;
  investedCost: number;
  holdingsValue: number;
  portfolioValue: number;
  /** investedCost ÷ (available + invested) × 100 */
  capitalUtilizationPercent: number | null;
}

export interface PortfolioSeriesInput {
  startingBalance: number;
  adjustments: readonly CoinAdjustment[];
  lots: readonly LotRecord[];
  sales: readonly SaleRecord[];
  observations: readonly PriceObservation[];
  taxRate: number;
  timeZone: string;
  range: { start: Date | string; end: Date | string };
}

/**
 * Reconstructs end-of-day portfolio value from the ledger:
 *   available(d)  = starting balance + adjustments ≤ d − purchases ≤ d + net sale proceeds ≤ d
 *   holdings(d)   = Σ copies held at end of d × last price observed on or before d × (1 − tax),
 *                   or purchase cost if the player had not been priced yet
 *   portfolio(d)  = available(d) + holdings(d)
 * Uses the current tax rate for valuation, the same rule as unrealized P&L.
 */
export function portfolioValueSeries(input: PortfolioSeriesInput): PortfolioValuePoint[] {
  const { timeZone } = input;
  const bps = toBps(input.taxRate);
  const keys = enumeratePeriods(input.range.start, input.range.end, "day", timeZone);
  if (keys.length === 0) return [];

  const dayOf = (iso: string) => periodKey(iso, "day", timeZone);
  const lotsById = new Map(input.lots.map((l) => [l.id, l]));

  type Event = { key: string; cashUnits: number };
  const cashEvents: Event[] = [];
  for (const adj of input.adjustments) cashEvents.push({ key: dayOf(adj.occurredAt), cashUnits: coinsToUnits(adj.amount) });
  for (const lot of input.lots) cashEvents.push({ key: dayOf(lot.acquiredAt), cashUnits: -lot.unitCost * lot.quantity * BPS_SCALE });
  for (const sale of input.sales) {
    cashEvents.push({ key: dayOf(sale.soldAt), cashUnits: saleProceedsUnits(sale.unitPrice, sale.quantity, sale.taxRate).net });
  }
  cashEvents.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const salesByLot = new Map<string, { key: string; quantity: number }[]>();
  for (const sale of input.sales) {
    if (!lotsById.has(sale.tradeId)) continue;
    const list = salesByLot.get(sale.tradeId) ?? [];
    list.push({ key: dayOf(sale.soldAt), quantity: sale.quantity });
    salesByLot.set(sale.tradeId, list);
  }

  const obsByPlayer = new Map<string, { key: string; price: number }[]>();
  for (const obs of sortObservations(input.observations)) {
    const list = obsByPlayer.get(obs.playerId) ?? [];
    list.push({ key: dayOf(obs.observedAt), price: obs.price });
    obsByPlayer.set(obs.playerId, list);
  }
  const lotDays = input.lots.map((lot) => ({ lot, key: dayOf(lot.acquiredAt) }));

  let cash = coinsToUnits(input.startingBalance);
  let cursor = 0;
  const points: PortfolioValuePoint[] = [];

  for (const key of keys) {
    while (cursor < cashEvents.length && cashEvents[cursor].key <= key) {
      cash += cashEvents[cursor].cashUnits;
      cursor += 1;
    }

    let invested = 0;
    let holdingsValue = 0;
    for (const { lot, key: acquiredKey } of lotDays) {
      if (acquiredKey > key) continue;
      const sold = (salesByLot.get(lot.id) ?? []).filter((s) => s.key <= key).reduce((s, x) => s + x.quantity, 0);
      const remaining = lot.quantity - sold;
      if (remaining <= 0) continue;
      const costUnits = lot.unitCost * remaining * BPS_SCALE;
      invested += costUnits;
      const priced = lastPriceOnOrBefore(obsByPlayer.get(lot.playerId), key);
      holdingsValue += priced === null ? costUnits : priced * remaining * (BPS_SCALE - bps);
    }

    points.push({
      key,
      availableCoins: unitsToCoins(cash),
      investedCost: unitsToCoins(invested),
      holdingsValue: unitsToCoins(holdingsValue),
      portfolioValue: unitsToCoins(cash + holdingsValue),
      capitalUtilizationPercent: cash + invested > 0 ? percentOf(invested, cash + invested) : null,
    });
  }
  return points;
}

function lastPriceOnOrBefore(list: { key: string; price: number }[] | undefined, key: string): number | null {
  if (!list) return null;
  let price: number | null = null;
  for (const entry of list) {
    if (entry.key > key) break;
    price = entry.price;
  }
  return price;
}

