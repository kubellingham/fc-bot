import { describe, expect, it } from "vitest";
import { FinanceInputError, roundCoins, toBps } from "./money";
import {
  breakEvenSalePrice,
  breakEvenSalePriceForPosition,
  calculateSale,
  calculateSaleProceeds,
  positionProfitAtPrice,
  profitAtPrice,
} from "./tax";

const TAX = 0.05;

describe("calculateSaleProceeds — the 5% EA transaction tax", () => {
  it("deducts 5% of the sale price", () => {
    expect(calculateSaleProceeds(12_000, 1, TAX)).toEqual({ grossProceeds: 12_000, tax: 600, netProceeds: 11_400 });
  });

  it("scales with quantity", () => {
    expect(calculateSaleProceeds(12_000, 3, TAX)).toEqual({ grossProceeds: 36_000, tax: 1_800, netProceeds: 34_200 });
  });

  it("keeps fractional tax instead of rounding intermediate values", () => {
    expect(calculateSaleProceeds(150, 1, TAX)).toEqual({ grossProceeds: 150, tax: 7.5, netProceeds: 142.5 });
  });

  it("is exact for values that are not representable as binary floats", () => {
    // 3 × 1,234,567 × 5% = 185,185.05 — naive float maths gives 185185.05000000002
    const result = calculateSaleProceeds(1_234_567, 3, TAX);
    expect(result.tax).toBe(185_185.05);
    expect(result.netProceeds).toBe(3_518_515.95);
    expect(result.tax + result.netProceeds).toBe(result.grossProceeds);
  });

  it("supports a configurable tax rate, including zero", () => {
    expect(calculateSaleProceeds(10_000, 1, 0)).toEqual({ grossProceeds: 10_000, tax: 0, netProceeds: 10_000 });
    expect(calculateSaleProceeds(10_000, 1, 0.1)).toEqual({ grossProceeds: 10_000, tax: 1_000, netProceeds: 9_000 });
  });

  it.each([
    [0, "Sale price must be at least 1."],
    [-100, "Sale price must be at least 1."],
    [100.5, "Sale price must be a whole number of coins."],
    [Number.NaN, "Sale price must be a number."],
    [Number.POSITIVE_INFINITY, "Sale price must be a number."],
  ])("rejects an invalid sale price (%s)", (price, message) => {
    expect(() => calculateSaleProceeds(price, 1, TAX)).toThrow(new FinanceInputError(message));
  });

  it.each([0, -1, 1.5, 10_001])("rejects an invalid quantity (%s)", (qty) => {
    expect(() => calculateSaleProceeds(1_000, qty, TAX)).toThrow(FinanceInputError);
  });

  it.each([-0.01, 1, 1.5, Number.NaN, 0.05001])("rejects an invalid tax rate (%s)", (rate) => {
    expect(() => calculateSaleProceeds(1_000, 1, rate)).toThrow(FinanceInputError);
  });
});

describe("calculateSale — profit and ROI", () => {
  it("computes profit and ROI for a single card", () => {
    expect(calculateSale({ unitPrice: 12_000, unitCost: 10_000, quantity: 1, taxRate: TAX })).toEqual({
      grossProceeds: 12_000,
      tax: 600,
      netProceeds: 11_400,
      acquisitionCost: 10_000,
      netProfit: 1_400,
      roiPercent: 14,
    });
  });

  it("computes totals for multiple units", () => {
    const r = calculateSale({ unitPrice: 12_000, unitCost: 10_000, quantity: 3, taxRate: TAX });
    expect(r.acquisitionCost).toBe(30_000);
    expect(r.netProceeds).toBe(34_200); // 12,000 × 3 × 0.95
    expect(r.netProfit).toBe(4_200);
    expect(r.roiPercent).toBe(14);
  });

  it("reports a loss when the tax eats the margin", () => {
    const r = calculateSale({ unitPrice: 20_000, unitCost: 20_000, quantity: 1, taxRate: TAX });
    expect(r.netProfit).toBe(-1_000);
    expect(r.roiPercent).toBe(-5);
  });

  it("identifies exact break-even", () => {
    const r = calculateSale({ unitPrice: 1_000, unitCost: 950, quantity: 1, taxRate: TAX });
    expect(r.netProfit).toBe(0);
    expect(r.roiPercent).toBe(0);
  });

  it("returns null ROI for zero-cost cards (pack pulls) instead of dividing by zero", () => {
    const r = calculateSale({ unitPrice: 10_000, unitCost: 0, quantity: 2, taxRate: TAX });
    expect(r.netProfit).toBe(19_000);
    expect(r.roiPercent).toBeNull();
  });

  it("rejects a negative purchase price", () => {
    expect(() => calculateSale({ unitPrice: 1_000, unitCost: -1, quantity: 1, taxRate: TAX })).toThrow(
      "Purchase price cannot be negative.",
    );
  });
});

describe("break-even sale price", () => {
  it("is the smallest whole price that recovers cost after tax", () => {
    expect(breakEvenSalePrice(950, TAX)).toBe(1_000);
    const p = breakEvenSalePrice(1_000, TAX); // 1,000 / 0.95 = 1,052.63…
    expect(p).toBe(1_053);
    expect(calculateSale({ unitPrice: p, unitCost: 1_000, quantity: 1, taxRate: TAX }).netProfit).toBeGreaterThanOrEqual(0);
    expect(calculateSale({ unitPrice: p - 1, unitCost: 1_000, quantity: 1, taxRate: TAX }).netProfit).toBeLessThan(0);
  });

  it("is zero for free cards and equals cost with no tax", () => {
    expect(breakEvenSalePrice(0, TAX)).toBe(0);
    expect(breakEvenSalePrice(5_000, 0)).toBe(5_000);
  });

  it("handles a position with a fractional average cost", () => {
    // 2 copies costing 21,000 in total → 10,500 average → 10,500 / 0.95 = 11,052.63…
    expect(breakEvenSalePriceForPosition(21_000, 2, TAX)).toBe(11_053);
    // 3 copies, 10,000 + 10,000 + 10,001 = 30,001 → 10,000.33 avg → 10,526.67 → 10,527
    expect(breakEvenSalePriceForPosition(30_001, 3, TAX)).toBe(10_527);
  });
});

describe("profitAtPrice / positionProfitAtPrice", () => {
  it("projects the per-card profit at a target sale price", () => {
    expect(profitAtPrice(10_000, 11_000, TAX).netProfit).toBe(450);
  });

  it("uses the exact total cost of a mixed-price position", () => {
    // 3 copies costing 30,001 in total, all sold at 11,000: 33,000 × 0.95 − 30,001
    const r = positionProfitAtPrice(30_001, 3, 11_000, TAX);
    expect(r.netProceeds).toBe(31_350);
    expect(r.netProfit).toBe(1_349);
  });
});

describe("helpers", () => {
  it("converts tax rates to basis points", () => {
    expect(toBps(0.05)).toBe(500);
    expect(toBps(0.0525)).toBe(525);
    expect(toBps(0)).toBe(0);
  });

  it("rounds half away from zero and never returns -0", () => {
    expect(roundCoins(7.5)).toBe(8);
    expect(roundCoins(-7.5)).toBe(-8);
    expect(roundCoins(-0.4)).toBe(0);
    expect(Object.is(roundCoins(-0.4), -0)).toBe(false);
  });
});
