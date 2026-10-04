import { createFormatter, type FormatPrefs } from "@/lib/format";
import type { AnalystContext } from "./context";
import type { Briefing, InsightItem } from "./schemas";

/**
 * Deterministic briefing built from the same context the AI receives. Used when
 * no AI provider is configured or the AI request fails. It only restates and
 * ranks computed facts — it never speculates.
 */
export function rulesBriefing(context: AnalystContext, prefs: FormatPrefs): Briefing {
  const f = createFormatter(prefs);
  const p = context.portfolio;
  const s30 = context.tradeStats.last30Days;
  const all = context.tradeStats.allTime;
  const observations: InsightItem[] = [];
  const risks: InsightItem[] = [];
  const opportunities: InsightItem[] = [];
  const limitations: string[] = [
    "Automated summary — no AI model was used. It restates figures from your records without interpretation.",
  ];

  const summaryParts = [
    `Portfolio value is ${f.coins(p.portfolioValue)} coins: ${f.coins(p.availableCoins)} available and ${f.coins(p.estimatedHoldingsValueAfterTax)} estimated in cards after tax.`,
    `Realized P&L is ${f.signedCoins(p.realizedProfit)} and unrealized P&L ${f.signedCoins(p.unrealizedProfit)}.`,
  ];
  if (s30.sales > 0) {
    summaryParts.push(`In the last 30 days you completed ${s30.sales} sale${s30.sales === 1 ? "" : "s"} for ${f.signedCoins(s30.realizedProfit)} with a ${f.percent(s30.winRatePercent)} win rate.`);
  } else {
    summaryParts.push("No sales were recorded in the last 30 days.");
  }

  // Biggest recorded movers over 7 days.
  const movers = context.priceHistory
    .filter((h) => h.change7dPercent !== null)
    .sort((a, b) => Math.abs(b.change7dPercent!) - Math.abs(a.change7dPercent!))
    .slice(0, 3);
  for (const m of movers) {
    observations.push({
      statement: `${m.player} moved ${f.signedPercent(m.change7dPercent)} over 7 days of recorded prices.`,
      evidence: `Latest recorded price ${f.coins(m.latestPrice)} (${Math.round(m.latestAgeHours ?? 0)}h old), ${m.totalObservations} observations.`,
      players: [m.player],
    });
  }
  const trending = context.priceHistory.filter((h) => h.trend30d && h.trend30d.direction !== "flat" && h.trend30d.rSquared >= 0.6).slice(0, 2);
  for (const t of trending) {
    observations.push({
      statement: `${t.player} shows a consistent ${t.trend30d!.direction} trend in your recorded prices.`,
      evidence: `Linear fit ${f.signedPercent(t.trend30d!.percentPerDay)} per day over 30 days, R² ${t.trend30d!.rSquared}.`,
      players: [t.player],
    });
  }
  if (all.sales >= 3) {
    observations.push({
      statement: `All-time win rate is ${f.percent(all.winRatePercent)} across ${all.sales} sales.`,
      evidence: `${all.wins} wins, ${all.losses} losses, ${all.breakeven} break-even; average ${f.signedCoins(all.averageProfitPerSale)} per sale.`,
      players: [],
    });
  }

  for (const h of context.holdings.filter((x) => x.unrealizedProfit !== null && x.unrealizedProfit < 0).slice(0, 3)) {
    risks.push({
      statement: `${h.player} is below break-even at its latest recorded price.`,
      evidence: `Latest ${f.coins(h.latestPrice)} vs break-even sale price ${f.coins(h.breakEvenSalePrice)}; unrealized ${f.signedCoins(h.unrealizedProfit)}.`,
      players: [h.player],
    });
  }
  const stale = context.holdings.filter((h) => h.latestPriceAgeHours === null || h.latestPriceAgeHours > 48);
  if (stale.length > 0) {
    risks.push({
      statement: `${stale.length} holding${stale.length === 1 ? " has" : "s have"} no price recorded in the last 48 hours.`,
      evidence: stale.slice(0, 5).map((h) => h.player).join(", "),
      players: stale.slice(0, 5).map((h) => h.player),
    });
  }
  const invested = p.investedCost ?? 0;
  const largest = context.holdings[0];
  if (largest && invested > 0 && (largest.totalCost ?? 0) / invested >= 0.5 && context.holdings.length > 1) {
    risks.push({
      statement: `${largest.player} accounts for over half of your invested coins.`,
      evidence: `${f.coins(largest.totalCost)} of ${f.coins(invested)} invested.`,
      players: [largest.player],
    });
  }

  for (const w of context.watchlist.filter((x) => x.atOrBelowBuyTarget).slice(0, 3)) {
    opportunities.push({
      statement: `${w.player} was last recorded at or below your buy target.`,
      evidence: `Recorded ${f.coins(w.latestPrice)} vs target ${f.coins(w.targetBuyPrice)} (${Math.round(w.latestAgeHours ?? 0)}h ago). Check the current market before acting.`,
      players: [w.player],
    });
  }
  for (const w of context.watchlist.filter((x) => x.atOrAboveSellTarget).slice(0, 2)) {
    opportunities.push({
      statement: `${w.player} was last recorded at or above your sell target.`,
      evidence: `Recorded ${f.coins(w.latestPrice)} vs target ${f.coins(w.targetSellPrice)}.`,
      players: [w.player],
    });
  }

  if (p.holdingsWithoutAnyPrice > 0) {
    limitations.push(`${p.holdingsWithoutAnyPrice} holding${p.holdingsWithoutAnyPrice === 1 ? " has" : "s have"} never been priced and ${p.holdingsWithoutAnyPrice === 1 ? "is" : "are"} valued at cost.`);
  }
  if (context.priceHistory.length === 0) limitations.push("No price observations recorded yet, so trends can't be assessed.");
  if (context.truncation.playersWithPricesOmitted > 0) {
    limitations.push(`Only the ${context.priceHistory.length} most relevant players' price histories were considered.`);
  }

  const observationsTotal = context.priceHistory.reduce((n, h) => n + h.totalObservations, 0);
  const confidence: Briefing["confidence"] = observationsTotal >= 30 && all.sales >= 10 ? "medium" : "low";

  return {
    summary: summaryParts.join(" "),
    observations: observations.slice(0, 6),
    risks: risks.slice(0, 4),
    opportunities: opportunities.slice(0, 4),
    confidence,
    dataLimitations: limitations.slice(0, 8),
  };
}
