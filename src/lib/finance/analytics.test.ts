import { describe, expect, it } from "vitest";
import {
  cumulativeProfitByDay,
  playerPerformance,
  portfolioValueSeries,
  profitByPeriod,
  realizedTrades,
  tradeStats,
  tradesSoldBetween,
} from "./analytics";
import { dayKey, enumeratePeriods, monthKey, weekKey } from "./dates";
import { buildHoldings } from "./holdings";
import { summarizeLots } from "./lots";
import { computePortfolioSummary } from "./portfolio";
import { latestPricesByPlayer } from "./prices";
import type { LotRecord, PriceObservation, SaleRecord } from "./types";

const TAX = 0.05;
const lots: LotRecord[] = [
  { id: "l1", playerId: "A", quantity: 3, unitCost: 10_000, acquiredAt: "2026-09-01T10:00:00.000Z" },
  { id: "l2", playerId: "B", quantity: 1, unitCost: 50_000, acquiredAt: "2026-09-02T10:00:00.000Z" },
  { id: "l3", playerId: "C", quantity: 1, unitCost: 950, acquiredAt: "2026-09-02T10:00:00.000Z" },
];
const sales: SaleRecord[] = [
  // win: 2 × (12,000 × 0.95 − 10,000) = 2,800, held 24h
  { id: "s1", tradeId: "l1", quantity: 2, unitPrice: 12_000, taxRate: TAX, soldAt: "2026-09-02T10:00:00.000Z" },
  // loss: 45,000 × 0.95 − 50,000 = −7,250, held 72h
  { id: "s2", tradeId: "l2", quantity: 1, unitPrice: 45_000, taxRate: TAX, soldAt: "2026-09-05T10:00:00.000Z" },
  // break-even: 1,000 × 0.95 − 950 = 0, held 48h
  { id: "s3", tradeId: "l3", quantity: 1, unitPrice: 1_000, taxRate: TAX, soldAt: "2026-09-04T10:00:00.000Z" },
];
const summaries = summarizeLots(lots, sales);
const trades = realizedTrades(summaries);

describe("realizedTrades", () => {
  it("produces one record per sale, ordered by sale time", () => {
    expect(trades.map((t) => [t.saleId, t.profit])).toEqual([
      ["s1", 2_800],
      ["s3", 0],
      ["s2", -7_250],
    ]);
    expect(trades[0]).toMatchObject({ costBasis: 20_000, netProceeds: 22_800, tax: 1_200, roiPercent: 14, holdingHours: 24 });
  });
});

describe("tradeStats", () => {
  it("computes win rate, average profit and quantity-weighted holding duration", () => {
    const s = tradeStats(trades);
    expect(s).toMatchObject({
      count: 3,
      wins: 1,
      losses: 1,
      breakeven: 1,
      totalProfit: -4_450,
      totalCostBasis: 70_950,
      totalTax: 1_200 + 2_250 + 50,
      unitsSold: 4,
    });
    expect(s.winRatePercent).toBeCloseTo(33.333, 2);
    expect(s.averageProfit).toBeCloseTo(-4_450 / 3, 10);
    expect(s.roiPercent).toBeCloseTo((-4_450 / 70_950) * 100, 10);
    // (24h × 2 + 72h × 1 + 48h × 1) / 4 units = 42h
    expect(s.averageHoldingHours).toBe(42);
  });

  it("returns nulls rather than NaN when there are no trades", () => {
    expect(tradeStats([])).toMatchObject({ count: 0, winRatePercent: null, averageProfit: null, roiPercent: null, averageHoldingHours: null });
  });
});

describe("tradesSoldBetween", () => {
  it("filters by sale date", () => {
    expect(tradesSoldBetween(trades, new Date("2026-09-04T00:00:00Z"), new Date("2026-09-30T00:00:00Z")).map((t) => t.saleId)).toEqual(["s3", "s2"]);
    expect(tradesSoldBetween(trades, null, new Date("2026-09-03T00:00:00Z"))).toHaveLength(1);
  });
});

describe("profitByPeriod", () => {
  it("zero-fills empty days", () => {
    const days = profitByPeriod(trades, "day", "UTC", { start: "2026-09-01T00:00:00Z", end: "2026-09-05T23:00:00Z" });
    expect(days).toEqual([
      { key: "2026-09-01", profit: 0, trades: 0, wins: 0 },
      { key: "2026-09-02", profit: 2_800, trades: 1, wins: 1 },
      { key: "2026-09-03", profit: 0, trades: 0, wins: 0 },
      { key: "2026-09-04", profit: 0, trades: 1, wins: 0 },
      { key: "2026-09-05", profit: -7_250, trades: 1, wins: 0 },
    ]);
  });

  it("buckets by week (Monday start) and month", () => {
    const weeks = profitByPeriod(trades, "week", "UTC", { start: "2026-09-01T00:00:00Z", end: "2026-09-10T00:00:00Z" });
    // 2026-09-01 is a Tuesday → week of Monday 2026-08-31
    expect(weeks).toEqual([
      { key: "2026-08-31", profit: -4_450, trades: 3, wins: 1 },
      { key: "2026-09-07", profit: 0, trades: 0, wins: 0 },
    ]);
    const months = profitByPeriod(trades, "month", "UTC", { start: "2026-08-15T00:00:00Z", end: "2026-09-30T00:00:00Z" });
    expect(months.map((m) => [m.key, m.profit])).toEqual([
      ["2026-08", 0],
      ["2026-09", -4_450],
    ]);
  });

  it("respects the user's time zone when assigning days", () => {
    const late = realizedTrades(
      summarizeLots(
        [lots[0]],
        [{ id: "z", tradeId: "l1", quantity: 1, unitPrice: 12_000, taxRate: TAX, soldAt: "2026-09-02T23:30:00.000Z" }],
      ),
    );
    const utc = profitByPeriod(late, "day", "UTC", { start: "2026-09-02T00:00:00Z", end: "2026-09-03T12:00:00Z" });
    const tokyo = profitByPeriod(late, "day", "Asia/Tokyo", { start: "2026-09-02T00:00:00Z", end: "2026-09-03T12:00:00Z" });
    expect(utc.find((d) => d.trades)?.key).toBe("2026-09-02");
    expect(tokyo.find((d) => d.trades)?.key).toBe("2026-09-03");
  });
});

describe("cumulativeProfitByDay", () => {
  it("carries in profit realized before the range", () => {
    const series = cumulativeProfitByDay(trades, "UTC", { start: "2026-09-04T00:00:00Z", end: "2026-09-05T00:00:00Z" });
    expect(series).toEqual([
      { key: "2026-09-04", profit: 0, cumulativeProfit: 2_800, cumulativeRoiPercent: (2_800 / 20_950) * 100 },
      { key: "2026-09-05", profit: -7_250, cumulativeProfit: -4_450, cumulativeRoiPercent: (-4_450 / 70_950) * 100 },
    ]);
  });
});

describe("playerPerformance", () => {
  it("ranks players by realized profit", () => {
    expect(playerPerformance(trades).map((p) => [p.playerId, p.profit, p.trades])).toEqual([
      ["A", 2_800, 1],
      ["C", 0, 1],
      ["B", -7_250, 1],
    ]);
  });
});

describe("portfolioValueSeries", () => {
  const observations: PriceObservation[] = [
    { id: "o1", playerId: "A", price: 11_000, observedAt: "2026-09-03T08:00:00.000Z" },
  ];

  it("reconstructs end-of-day balances and matches the live summary on the final day", () => {
    const series = portfolioValueSeries({
      startingBalance: 200_000,
      adjustments: [{ id: "adj", amount: 1_000, occurredAt: "2026-09-04T12:00:00.000Z" }],
      lots,
      sales,
      observations,
      taxRate: TAX,
      timeZone: "UTC",
      range: { start: "2026-08-31T00:00:00Z", end: "2026-09-06T00:00:00Z" },
    });
    expect(series[0]).toMatchObject({ key: "2026-08-31", availableCoins: 200_000, investedCost: 0, portfolioValue: 200_000 });
    // 1 Sept: bought 3 × 10,000, unpriced → valued at cost
    expect(series[1]).toMatchObject({ availableCoins: 170_000, investedCost: 30_000, holdingsValue: 30_000, portfolioValue: 200_000 });
    // 3 Sept: 1 copy of A left, priced at 11,000 → 10,450 after tax
    const sep3 = series.find((p) => p.key === "2026-09-03");
    expect(sep3).toMatchObject({ investedCost: 60_950, holdingsValue: 10_450 + 50_000 + 950 });

    const last = series[series.length - 1];
    const summary = computePortfolioSummary({
      startingBalance: 200_000,
      adjustments: [{ amount: 1_000 }],
      lots: summaries,
      holdings: buildHoldings(summaries, latestPricesByPlayer(observations), TAX),
    });
    expect(last.availableCoins).toBe(summary.availableCoins);
    expect(last.investedCost).toBe(summary.investedCost);
    expect(last.holdingsValue).toBe(summary.holdingsEstimatedValue);
    expect(last.portfolioValue).toBe(summary.portfolioValue);
  });
});

describe("date keys", () => {
  it("assigns local calendar days in different time zones", () => {
    expect(dayKey("2026-03-01T23:30:00Z", "Europe/Berlin")).toBe("2026-03-02");
    expect(dayKey("2026-03-01T23:30:00Z", "America/New_York")).toBe("2026-03-01");
    expect(weekKey("2026-10-04T12:00:00Z", "UTC")).toBe("2026-09-28"); // Sunday → previous Monday
    expect(monthKey("2026-12-31T23:30:00Z", "Asia/Tokyo")).toBe("2027-01");
  });

  it("enumerates periods across DST changes and year boundaries", () => {
    const days = enumeratePeriods("2026-03-28T12:00:00Z", "2026-03-31T12:00:00Z", "day", "Europe/London");
    expect(days).toEqual(["2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31"]);
    expect(enumeratePeriods("2026-11-15T00:00:00Z", "2027-02-01T00:00:00Z", "month", "UTC")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(enumeratePeriods("2026-09-05T00:00:00Z", "2026-09-01T00:00:00Z", "day", "UTC")).toEqual([]);
  });
});

describe("zonedTimeToUtc", () => {
  it("converts wall-clock times in a zone to UTC", async () => {
    const { zonedTimeToUtc } = await import("./dates");
    expect(zonedTimeToUtc(2026, 9, 1, 14, 30, "Europe/London").toISOString()).toBe("2026-09-01T13:30:00.000Z");
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
    expect(zonedTimeToUtc(2026, 6, 1, 0, 0, "UTC").toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(zonedTimeToUtc(2026, 9, 1, 8, 0, "Asia/Kolkata").toISOString()).toBe("2026-09-01T02:30:00.000Z");
  });

  it("handles DST transitions without throwing", async () => {
    const { zonedTimeToUtc } = await import("./dates");
    // 2026-03-29 01:30 does not exist in London (clocks jump 01:00 → 02:00).
    expect(zonedTimeToUtc(2026, 3, 29, 1, 30, "Europe/London").toISOString()).toBe("2026-03-29T01:30:00.000Z");
    // 2026-10-25 01:30 happens twice in London; the earlier (BST) instant is used.
    expect(zonedTimeToUtc(2026, 10, 25, 1, 30, "Europe/London").toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(zonedTimeToUtc(2026, 3, 29, 3, 0, "Europe/London").toISOString()).toBe("2026-03-29T02:00:00.000Z");
  });
});
