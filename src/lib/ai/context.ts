import type { Adjustment, Observation, Player, Settings, WatchlistItem } from "@/lib/domain";
import { playerLabel } from "@/lib/domain";
import {
  playerPerformance,
  priceChangeOverWindow,
  priceStats,
  priceTrend,
  realizedTrades,
  sortObservations,
  tradeStats,
  tradesSoldBetween,
  type Holding,
  type LotSummary,
  type PortfolioSummary,
  type TradeStats,
} from "@/lib/finance";

/**
 * Builds the only data the AI analyst ever sees: a compact, structured summary
 * of the user's own records, with every derived figure computed by the finance
 * module (the model never does arithmetic on raw rows). Sizes are capped so the
 * prompt stays bounded regardless of how much history a user has.
 */

export const LIMITS = {
  holdings: 40,
  pricedPlayers: 25,
  observationsPerPlayer: 30,
  recentSales: 25,
  watchlist: 30,
  maxChars: 60_000,
} as const;

export interface AnalystContextInput {
  now: Date;
  settings: Settings;
  players: Map<string, Player>;
  lots: LotSummary[];
  holdings: Holding[];
  summary: PortfolioSummary;
  adjustments: Adjustment[];
  observations: Observation[];
  watchlist: WatchlistItem[];
}

const r0 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n));
const r1 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
const hoursSince = (iso: string, now: Date) => r1((now.getTime() - Date.parse(iso)) / 3_600_000);

function statsView(s: TradeStats) {
  return {
    sales: s.count,
    wins: s.wins,
    losses: s.losses,
    breakeven: s.breakeven,
    winRatePercent: r1(s.winRatePercent),
    realizedProfit: r0(s.totalProfit),
    roiPercent: r1(s.roiPercent),
    averageProfitPerSale: r0(s.averageProfit),
    averageHoldingHours: r1(s.averageHoldingHours),
    taxPaid: r0(s.totalTax),
  };
}

export function buildAnalystContext(input: AnalystContextInput) {
  const { now, players } = input;
  const label = (id: string) => {
    const p = players.get(id);
    return p ? playerLabel(p) : "Unknown player";
  };

  const obsByPlayer = new Map<string, Observation[]>();
  for (const o of sortObservations(input.observations)) {
    const list = obsByPlayer.get(o.playerId) ?? [];
    list.push(o);
    obsByPlayer.set(o.playerId, list);
  }

  const trades = realizedTrades(input.lots);
  const last30 = tradesSoldBetween(trades, new Date(now.getTime() - 30 * 86_400_000), now);

  const holdings = [...input.holdings]
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, LIMITS.holdings)
    .map((h) => ({
      player: label(h.playerId),
      quantity: h.quantity,
      averageCost: r0(h.averageCost),
      totalCost: r0(h.totalCost),
      latestPrice: h.latestPrice,
      latestPriceAgeHours: h.latestObservedAt ? hoursSince(h.latestObservedAt, now) : null,
      afterTaxValue: r0(h.liquidationValue),
      unrealizedProfit: r0(h.unrealizedProfit),
      unrealizedRoiPercent: r1(h.unrealizedRoiPercent),
      breakEvenSalePrice: h.breakEvenPrice,
      heldSinceHours: hoursSince(h.firstAcquiredAt, now),
    }));

  // Price histories: held players first, then watched, then the most-observed.
  const watched = new Set(input.watchlist.filter((w) => !w.archivedAt).map((w) => w.playerId));
  const held = new Set(input.holdings.map((h) => h.playerId));
  const priority = [...obsByPlayer.keys()].sort((a, b) => {
    const score = (id: string) => (held.has(id) ? 2 : 0) + (watched.has(id) ? 1 : 0);
    return score(b) - score(a) || (obsByPlayer.get(b)?.length ?? 0) - (obsByPlayer.get(a)?.length ?? 0);
  });
  const priceHistory = priority.slice(0, LIMITS.pricedPlayers).map((playerId) => {
    const obs = obsByPlayer.get(playerId) ?? [];
    const latest = obs.at(-1)!;
    const window30 = obs.filter((o) => Date.parse(o.observedAt) >= Date.parse(latest.observedAt) - 30 * 86_400_000);
    const stats = priceStats(window30);
    const trend = priceTrend(window30);
    return {
      player: label(playerId),
      totalObservations: obs.length,
      latestPrice: latest.price,
      latestAgeHours: hoursSince(latest.observedAt, now),
      change24hPercent: r1(priceChangeOverWindow(obs, 24)?.percentChange),
      change7dPercent: r1(priceChangeOverWindow(obs, 168)?.percentChange),
      change30dPercent: r1(priceChangeOverWindow(obs, 720)?.percentChange),
      range30d: stats ? { min: stats.min, max: stats.max, mean: r0(stats.mean), volatilityPercent: r1(stats.volatilityPercent) } : null,
      trend30d: trend ? { direction: trend.direction, percentPerDay: r1(trend.percentPerDay), rSquared: Math.round(trend.rSquared * 100) / 100 } : null,
      recentObservations: obs.slice(-LIMITS.observationsPerPlayer).map((o) => [o.observedAt.slice(0, 16), o.price] as const),
    };
  });

  const watchlist = input.watchlist
    .filter((w) => !w.archivedAt)
    .slice(0, LIMITS.watchlist)
    .map((w) => {
      const latest = obsByPlayer.get(w.playerId)?.at(-1) ?? null;
      return {
        player: label(w.playerId),
        targetBuyPrice: w.targetBuyPrice,
        targetSellPrice: w.targetSellPrice,
        latestPrice: latest?.price ?? null,
        latestAgeHours: latest ? hoursSince(latest.observedAt, now) : null,
        atOrBelowBuyTarget: latest !== null && w.targetBuyPrice !== null && latest.price <= w.targetBuyPrice,
        atOrAboveSellTarget: latest !== null && w.targetSellPrice !== null && latest.price >= w.targetSellPrice,
      };
    });

  const recentSales = [...trades]
    .reverse()
    .slice(0, LIMITS.recentSales)
    .map((t) => ({
      player: label(t.playerId),
      quantity: t.quantity,
      buyPrice: t.unitCost,
      sellPrice: t.unitPrice,
      netProfit: r0(t.profit),
      roiPercent: r1(t.roiPercent),
      holdingHours: r1(t.holdingHours),
      soldAt: t.soldAt.slice(0, 16),
    }));

  const perf = playerPerformance(trades).map((p) => ({ player: label(p.playerId), sales: p.trades, realizedProfit: r0(p.profit), roiPercent: r1(p.roiPercent) }));

  const s = input.summary;
  const context = {
    generatedAt: now.toISOString(),
    units: "All amounts are EA Sports FC Ultimate Team coins.",
    dataProvenance:
      "Every price was manually recorded by the user and may be stale; there is no live market feed. Ages are in hours before generatedAt.",
    taxRatePercent: r1(input.settings.taxRate * 100),
    portfolio: {
      availableCoins: r0(s.availableCoins),
      investedCost: r0(s.investedCost),
      estimatedHoldingsValueAfterTax: r0(s.holdingsEstimatedValue),
      portfolioValue: r0(s.portfolioValue),
      realizedProfit: r0(s.realizedProfit),
      unrealizedProfit: r0(s.unrealizedProfit),
      totalRoiPercent: r1(s.totalRoiPercent),
      capitalUtilizationPercent: r1(s.capitalUtilizationPercent),
      holdingsWithoutAnyPrice: s.unpricedHoldings,
      balanceIsNegative: s.balanceIsNegative,
    },
    tradeStats: { last30Days: statsView(tradeStats(last30)), allTime: statsView(tradeStats(trades)) },
    holdings,
    priceHistory,
    watchlist,
    recentSales,
    bestPlayers: perf.slice(0, 5),
    worstPlayers: perf.filter((p) => (p.realizedProfit ?? 0) < 0).reverse().slice(0, 5),
    truncation: {
      holdingsOmitted: Math.max(0, input.holdings.length - holdings.length),
      playersWithPricesOmitted: Math.max(0, obsByPlayer.size - priceHistory.length),
      salesOmitted: Math.max(0, trades.length - recentSales.length),
    },
  };
  return context;
}

export type AnalystContext = ReturnType<typeof buildAnalystContext>;

/** Player labels the model is allowed to mention. */
export function knownPlayers(context: AnalystContext): Set<string> {
  const names = new Set<string>();
  for (const list of [context.holdings, context.priceHistory, context.watchlist, context.recentSales, context.bestPlayers, context.worstPlayers]) {
    for (const item of list) names.add(item.player);
  }
  return names;
}

/** Serialises the context, shrinking the largest sections until it fits the character budget. */
export function serializeContext(context: AnalystContext, maxChars: number = LIMITS.maxChars): string {
  let current = context;
  let json = JSON.stringify(current);
  let perPlayer: number = LIMITS.observationsPerPlayer;
  while (json.length > maxChars && perPlayer > 5) {
    perPlayer = Math.floor(perPlayer / 2);
    current = {
      ...current,
      priceHistory: current.priceHistory.map((p) => ({ ...p, recentObservations: p.recentObservations.slice(-perPlayer) })),
    };
    json = JSON.stringify(current);
  }
  while (json.length > maxChars && current.priceHistory.length > 5) {
    current = { ...current, priceHistory: current.priceHistory.slice(0, Math.ceil(current.priceHistory.length / 2)) };
    json = JSON.stringify(current);
  }
  return json.length > maxChars ? json.slice(0, maxChars) : json;
}

/** Whether there is enough recorded data for analysis to be meaningful. */
export function dataSufficiency(context: AnalystContext): { sufficient: boolean; reason: string | null } {
  const observations = context.priceHistory.reduce((n, p) => n + p.totalObservations, 0);
  const sales = context.tradeStats.allTime.sales;
  if (context.holdings.length === 0 && sales === 0 && observations === 0) {
    return { sufficient: false, reason: "There are no trades, holdings or recorded prices yet, so there is nothing to analyse." };
  }
  if (observations < 2 && sales === 0) {
    return {
      sufficient: false,
      reason: "Record a few prices or complete a sale first — with fewer than two data points any analysis would be guesswork.",
    };
  }
  return { sufficient: true, reason: null };
}
