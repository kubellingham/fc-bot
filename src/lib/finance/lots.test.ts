import { describe, expect, it } from "vitest";
import { InsufficientQuantityError, allocateFifo, summarizeLot, summarizeLots } from "./lots";
import type { LotRecord, SaleRecord } from "./types";

const lot = (over: Partial<LotRecord> = {}): LotRecord => ({
  id: "lot-1",
  playerId: "p-1",
  quantity: 5,
  unitCost: 10_000,
  acquiredAt: "2026-09-01T10:00:00.000Z",
  ...over,
});

const sale = (over: Partial<SaleRecord> = {}): SaleRecord => ({
  id: "s-1",
  tradeId: "lot-1",
  quantity: 1,
  unitPrice: 12_000,
  taxRate: 0.05,
  soldAt: "2026-09-02T10:00:00.000Z",
  ...over,
});

describe("summarizeLot", () => {
  it("treats an unsold lot as open with no realized P&L", () => {
    const s = summarizeLot(lot(), []);
    expect(s).toMatchObject({
      status: "open",
      soldQuantity: 0,
      remainingQuantity: 5,
      remainingCost: 50_000,
      costOfSold: 0,
      realizedProfit: 0,
      realizedRoiPercent: null,
      averageSalePrice: null,
      lastSoldAt: null,
    });
  });

  it("handles a partial sale", () => {
    const s = summarizeLot(lot(), [sale({ quantity: 2 })]);
    expect(s).toMatchObject({
      status: "partial",
      soldQuantity: 2,
      remainingQuantity: 3,
      costOfSold: 20_000,
      remainingCost: 30_000,
      grossProceeds: 24_000,
      tax: 1_200,
      netProceeds: 22_800,
      realizedProfit: 2_800,
      realizedRoiPercent: 14,
    });
  });

  it("closes a lot sold over several sales, honouring each sale's own tax rate", () => {
    const s = summarizeLot(lot(), [
      sale({ id: "a", quantity: 2, unitPrice: 12_000, soldAt: "2026-09-03T00:00:00.000Z" }),
      sale({ id: "b", quantity: 3, unitPrice: 11_000, taxRate: 0, soldAt: "2026-09-02T00:00:00.000Z" }),
    ]);
    expect(s.status).toBe("closed");
    expect(s.remainingQuantity).toBe(0);
    expect(s.netProceeds).toBe(22_800 + 33_000);
    expect(s.tax).toBe(1_200);
    expect(s.realizedProfit).toBe(55_800 - 50_000);
    expect(s.averageSalePrice).toBe((2 * 12_000 + 3 * 11_000) / 5);
    expect(s.lastSoldAt).toBe("2026-09-03T00:00:00.000Z");
  });

  it("rejects overselling", () => {
    expect(() => summarizeLot(lot({ quantity: 1 }), [sale({ quantity: 2 })])).toThrow(/exceeds purchased quantity/);
  });

  it("rejects a sale attributed to another lot", () => {
    expect(() => summarizeLot(lot(), [sale({ tradeId: "other" })])).toThrow(/wrong trade/);
  });

  it("handles zero-cost lots (pack pulls)", () => {
    const s = summarizeLot(lot({ unitCost: 0, quantity: 1 }), [sale()]);
    expect(s.realizedProfit).toBe(11_400);
    expect(s.realizedRoiPercent).toBeNull();
  });
});

describe("summarizeLots", () => {
  it("groups sales by lot", () => {
    const summaries = summarizeLots(
      [lot(), lot({ id: "lot-2", quantity: 1 })],
      [sale({ id: "x", tradeId: "lot-2" }), sale({ id: "y" })],
    );
    expect(summaries.map((s) => [s.lot.id, s.soldQuantity])).toEqual([
      ["lot-1", 1],
      ["lot-2", 1],
    ]);
  });

  it("rejects sales for lots that were not loaded", () => {
    expect(() => summarizeLots([lot()], [sale({ tradeId: "missing" })])).toThrow(/not loaded/);
  });
});

describe("allocateFifo", () => {
  const candidates = [
    { id: "newer", remainingQuantity: 3, acquiredAt: "2026-09-02T00:00:00.000Z" },
    { id: "older", remainingQuantity: 2, acquiredAt: "2026-09-01T00:00:00.000Z" },
    { id: "empty", remainingQuantity: 0, acquiredAt: "2026-08-01T00:00:00.000Z" },
  ];

  it("sells the oldest copies first", () => {
    expect(allocateFifo(candidates, 4)).toEqual([
      { lotId: "older", quantity: 2 },
      { lotId: "newer", quantity: 2 },
    ]);
  });

  it("uses a single lot when it suffices", () => {
    expect(allocateFifo(candidates, 1)).toEqual([{ lotId: "older", quantity: 1 }]);
  });

  it("refuses to sell more than is held", () => {
    expect(() => allocateFifo(candidates, 6)).toThrow(InsufficientQuantityError);
    try {
      allocateFifo(candidates, 6);
    } catch (e) {
      expect((e as InsufficientQuantityError).available).toBe(5);
    }
  });

  it("is deterministic when purchase times tie", () => {
    const tie = [
      { id: "b", remainingQuantity: 1, acquiredAt: "2026-09-01T00:00:00.000Z" },
      { id: "a", remainingQuantity: 1, acquiredAt: "2026-09-01T00:00:00.000Z" },
    ];
    expect(allocateFifo(tie, 1)).toEqual([{ lotId: "a", quantity: 1 }]);
  });

  it("rejects a non-positive quantity", () => {
    expect(() => allocateFifo(candidates, 0)).toThrow(/positive whole number/);
  });
});
