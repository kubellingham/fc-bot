import { describe, expect, it } from "vitest";
import { buildHoldings } from "./holdings";
import { summarizeLots } from "./lots";
import { computePortfolioSummary } from "./portfolio";
import type { LatestPrice, LotRecord, SaleRecord } from "./types";

const TAX = 0.05;

function lots(): LotRecord[] {
  return [
    { id: "a1", playerId: "A", quantity: 2, unitCost: 10_000, acquiredAt: "2026-09-01T00:00:00.000Z" },
    { id: "b1", playerId: "B", quantity: 1, unitCost: 30_000, acquiredAt: "2026-09-02T00:00:00.000Z" },
  ];
}
const sales: SaleRecord[] = [
  { id: "s1", tradeId: "a1", quantity: 1, unitPrice: 12_000, taxRate: TAX, soldAt: "2026-09-03T00:00:00.000Z" },
];

describe("buildHoldings", () => {
  it("averages cost across multiple purchases of the same player", () => {
    const summaries = summarizeLots(
      [
        { id: "x", playerId: "P", quantity: 2, unitCost: 10_000, acquiredAt: "2026-09-02T00:00:00.000Z" },
        { id: "y", playerId: "P", quantity: 1, unitCost: 13_000, acquiredAt: "2026-09-01T00:00:00.000Z" },
      ],
      [],
    );
    const prices = new Map<string, LatestPrice>([["P", { price: 12_000, observedAt: "2026-09-05T00:00:00.000Z" }]]);
    const [h] = buildHoldings(summaries, prices, TAX);
    expect(h).toMatchObject({
      playerId: "P",
      quantity: 3,
      openLots: 2,
      totalCost: 33_000,
      averageCost: 11_000,
      firstAcquiredAt: "2026-09-01T00:00:00.000Z",
      marketValue: 36_000,
      liquidationValue: 34_200,
      unrealizedProfit: 1_200,
      breakEvenPrice: 11_579, // 33,000 / (3 × 0.95) = 11,578.95
    });
    expect(h.unrealizedRoiPercent).toBeCloseTo((1_200 / 33_000) * 100, 10);
  });

  it("excludes fully sold lots and leaves unpriced holdings without estimates", () => {
    const summaries = summarizeLots(lots(), [...sales, { ...sales[0], id: "s2" }]);
    const holdings = buildHoldings(summaries, new Map(), TAX);
    expect(holdings.map((h) => h.playerId)).toEqual(["B"]);
    expect(holdings[0]).toMatchObject({ marketValue: null, liquidationValue: null, unrealizedProfit: null, latestPrice: null });
  });
});

describe("computePortfolioSummary", () => {
  it("separates realized, unrealized and available coins without double counting", () => {
    const summaries = summarizeLots(lots(), sales);
    const prices = new Map<string, LatestPrice>([["A", { price: 11_000, observedAt: "2026-09-04T00:00:00.000Z" }]]);
    const holdings = buildHoldings(summaries, prices, TAX);
    const s = computePortfolioSummary({
      startingBalance: 100_000,
      adjustments: [{ amount: 5_000 }],
      lots: summaries,
      holdings,
    });

    // 100,000 + 5,000 − 20,000 − 30,000 + 11,400
    expect(s.availableCoins).toBe(66_400);
    expect(s.investedCost).toBe(40_000);
    expect(s.realizedProfit).toBe(1_400);
    expect(s.realizedRoiPercent).toBe(14);
    // A: 1 copy × 11,000 × 0.95 = 10,450 vs cost 10,000
    expect(s.unrealizedProfit).toBe(450);
    expect(s.unrealizedRoiPercent).toBe(4.5);
    expect(s.totalProfit).toBe(1_850);
    expect(s.totalRoiPercent).toBe(9.25);
    expect(s.holdingsMarketValue).toBe(11_000);
    // B has never been priced, so it is carried at cost.
    expect(s.unpricedHoldings).toBe(1);
    expect(s.unpricedHoldingsCost).toBe(30_000);
    expect(s.holdingsEstimatedValue).toBe(40_450);
    expect(s.portfolioValue).toBe(106_850);
    // Portfolio value must equal capital contributed plus total profit.
    expect(s.portfolioValue).toBe(100_000 + 5_000 + s.totalProfit);
    expect(s.capitalUtilizationPercent).toBeCloseTo((40_000 / 106_400) * 100, 10);
    expect(s.balanceIsNegative).toBe(false);
  });

  it("returns the starting balance plus realized profit once everything is sold", () => {
    const summaries = summarizeLots(
      [lots()[0]],
      [
        { id: "s1", tradeId: "a1", quantity: 2, unitPrice: 9_000, taxRate: TAX, soldAt: "2026-09-03T00:00:00.000Z" },
      ],
    );
    const s = computePortfolioSummary({ startingBalance: 50_000, adjustments: [], lots: summaries, holdings: [] });
    expect(s.realizedProfit).toBe(-2_900); // 18,000 × 0.95 − 20,000
    expect(s.availableCoins).toBe(47_100);
    expect(s.portfolioValue).toBe(47_100);
    expect(s.investedCost).toBe(0);
    expect(s.capitalUtilizationPercent).toBe(0);
  });

  it("handles an empty portfolio", () => {
    const s = computePortfolioSummary({ startingBalance: 0, adjustments: [], lots: [], holdings: [] });
    expect(s).toMatchObject({
      availableCoins: 0,
      portfolioValue: 0,
      totalProfit: 0,
      realizedRoiPercent: null,
      unrealizedRoiPercent: null,
      totalRoiPercent: null,
      capitalUtilizationPercent: null,
    });
  });

  it("flags a negative balance when purchases exceed the coins on record", () => {
    const summaries = summarizeLots([lots()[0]], []);
    const s = computePortfolioSummary({ startingBalance: 0, adjustments: [], lots: summaries, holdings: [] });
    expect(s.availableCoins).toBe(-20_000);
    expect(s.balanceIsNegative).toBe(true);
    expect(s.capitalUtilizationPercent).toBeNull();
  });

  it("supports negative adjustments (coins spent outside trading)", () => {
    const s = computePortfolioSummary({ startingBalance: 10_000, adjustments: [{ amount: -2_500 }], lots: [], holdings: [] });
    expect(s.availableCoins).toBe(7_500);
  });

  it("rejects invalid inputs", () => {
    expect(() => computePortfolioSummary({ startingBalance: -1, adjustments: [], lots: [], holdings: [] })).toThrow();
    expect(() =>
      computePortfolioSummary({ startingBalance: 0, adjustments: [{ amount: 1.5 }], lots: [], holdings: [] }),
    ).toThrow(/whole numbers/);
  });
});
