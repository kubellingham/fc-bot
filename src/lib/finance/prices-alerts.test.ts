import { describe, expect, it } from "vitest";
import { evaluateAlert, nextAlertState, type AlertRule } from "./alerts";
import {
  detectPriceJumps,
  latestPricesByPlayer,
  priceChangeOverWindow,
  priceChangeSincePrevious,
  priceStats,
  priceTrend,
} from "./prices";
import type { PriceObservation } from "./types";

let seq = 0;
const obs = (price: number, observedAt: string, playerId = "P"): PriceObservation => ({
  id: `o${String(++seq).padStart(4, "0")}`,
  playerId,
  price,
  observedAt,
});

describe("latestPricesByPlayer", () => {
  it("picks the most recent observation for each player regardless of order", () => {
    const map = latestPricesByPlayer([
      obs(10_000, "2026-09-02T00:00:00Z", "A"),
      obs(9_000, "2026-09-03T00:00:00Z", "A"),
      obs(5_000, "2026-09-01T00:00:00Z", "B"),
    ]);
    expect(map.get("A")).toEqual({ price: 9_000, observedAt: "2026-09-03T00:00:00Z" });
    expect(map.get("B")?.price).toBe(5_000);
    expect(map.has("C")).toBe(false);
  });
});

describe("price changes", () => {
  const history = [
    obs(10_000, "2026-09-01T00:00:00Z"),
    obs(11_000, "2026-09-05T00:00:00Z"),
    obs(12_000, "2026-09-07T12:00:00Z"),
    obs(12_600, "2026-09-08T00:00:00Z"),
  ];

  it("compares against the latest observation at least the window older", () => {
    const day = priceChangeOverWindow(history, 24);
    expect(day).toMatchObject({ fromPrice: 11_000, toPrice: 12_600, absoluteChange: 1_600 });
    expect(day?.percentChange).toBeCloseTo(14.5454, 3);
    expect(priceChangeOverWindow(history, 24 * 7)?.fromPrice).toBe(10_000);
  });

  it("returns null when there is not enough history", () => {
    expect(priceChangeOverWindow(history, 24 * 30)).toBeNull();
    expect(priceChangeOverWindow([history[0]], 24)).toBeNull();
    expect(priceChangeOverWindow([obs(1, "2026-09-01T00:00:00Z"), obs(2, "2026-09-01T05:00:00Z")], 24)).toBeNull();
  });

  it("measures change since the previous observation", () => {
    expect(priceChangeSincePrevious(history)?.percentChange).toBeCloseTo(5, 10);
    expect(priceChangeSincePrevious([])).toBeNull();
  });
});

describe("priceStats / trend / jumps", () => {
  it("summarises observations", () => {
    const s = priceStats([obs(100, "2026-09-01T00:00:00Z"), obs(300, "2026-09-02T00:00:00Z")]);
    expect(s).toMatchObject({ count: 2, min: 100, max: 300, mean: 200 });
    expect(s?.volatilityPercent).toBeCloseTo(50, 10);
    expect(priceStats([])).toBeNull();
    expect(priceStats([obs(100, "2026-09-01T00:00:00Z")])?.volatilityPercent).toBeNull();
  });

  it("detects a rising trend and refuses to fit too little data", () => {
    const rising = [0, 1, 2, 3].map((d) => obs(10_000 + d * 500, `2026-09-0${d + 1}T00:00:00Z`));
    const t = priceTrend(rising);
    expect(t?.direction).toBe("rising");
    expect(t?.rSquared).toBeCloseTo(1, 10);
    expect(t?.percentPerDay).toBeCloseTo((500 / 10_750) * 100, 6);
    expect(priceTrend(rising.slice(0, 2))).toBeNull();
    const sameDay = [1, 2, 3].map((h) => obs(100 * h, `2026-09-01T0${h}:00:00Z`));
    expect(priceTrend(sameDay)).toBeNull();
  });

  it("calls a tiny slope flat", () => {
    const flat = [0, 1, 2, 3].map((d) => obs(10_000 + d, `2026-09-0${d + 1}T00:00:00Z`));
    expect(priceTrend(flat)?.direction).toBe("flat");
  });

  it("flags large moves between consecutive observations", () => {
    const jumps = detectPriceJumps([
      obs(10_000, "2026-09-01T00:00:00Z"),
      obs(10_500, "2026-09-02T00:00:00Z"),
      obs(7_000, "2026-09-03T00:00:00Z"),
    ]);
    expect(jumps).toHaveLength(1);
    expect(jumps[0].percentChange).toBeCloseTo(-33.333, 2);
  });
});

describe("evaluateAlert", () => {
  const rule = (over: Partial<AlertRule>): AlertRule => ({
    type: "price_below",
    targetValue: 10_000,
    lookbackHours: null,
    direction: "any",
    ...over,
  });

  it("price_below is inclusive of the target", () => {
    expect(evaluateAlert(rule({}), [obs(10_000, "2026-09-01T00:00:00Z")]).status).toBe("satisfied");
    expect(evaluateAlert(rule({}), [obs(10_050, "2026-09-01T00:00:00Z")]).status).toBe("not_satisfied");
  });

  it("price_above uses the latest observation", () => {
    const history = [obs(20_000, "2026-09-02T00:00:00Z"), obs(9_000, "2026-09-01T00:00:00Z")];
    expect(evaluateAlert(rule({ type: "price_above", targetValue: 15_000 }), history).status).toBe("satisfied");
  });

  it("reports insufficient data when nothing is recorded", () => {
    expect(evaluateAlert(rule({}), []).status).toBe("insufficient_data");
  });

  describe("pct_change", () => {
    const history = [
      obs(10_000, "2026-09-01T00:00:00Z"),
      obs(10_800, "2026-09-02T06:00:00Z"),
      obs(9_000, "2026-09-02T12:00:00Z"),
    ];

    it("compares with the previous observation by default", () => {
      const e = evaluateAlert(rule({ type: "pct_change", targetValue: 15 }), history);
      expect(e.status).toBe("satisfied");
      if (e.status !== "insufficient_data") expect(e.changePercent).toBeCloseTo(-16.667, 2);
    });

    it("respects direction", () => {
      expect(evaluateAlert(rule({ type: "pct_change", targetValue: 15, direction: "up" }), history).status).toBe(
        "not_satisfied",
      );
      expect(evaluateAlert(rule({ type: "pct_change", targetValue: 15, direction: "down" }), history).status).toBe(
        "satisfied",
      );
    });

    it("uses a lookback window when configured", () => {
      // 24h before the latest observation → baseline is 10,000 → −10%
      const e = evaluateAlert(rule({ type: "pct_change", targetValue: 10, lookbackHours: 24 }), history);
      expect(e.status).toBe("satisfied");
      if (e.status !== "insufficient_data") expect(e.baseline?.price).toBe(10_000);
      expect(evaluateAlert(rule({ type: "pct_change", targetValue: 10, lookbackHours: 24 * 7 }), history).status).toBe(
        "insufficient_data",
      );
    });

    it("needs two observations", () => {
      expect(evaluateAlert(rule({ type: "pct_change", targetValue: 5 }), [history[0]]).status).toBe("insufficient_data");
    });
  });
});

describe("nextAlertState", () => {
  const satisfied = evaluateAlert(
    { type: "price_below", targetValue: 10, lookbackHours: null, direction: "any" },
    [obs(5, "2026-09-01T00:00:00Z")],
  );
  const notSatisfied = evaluateAlert(
    { type: "price_below", targetValue: 1, lookbackHours: null, direction: "any" },
    [obs(5, "2026-09-01T00:00:00Z")],
  );

  it("fires once when the condition becomes true", () => {
    expect(nextAlertState(false, satisfied)).toEqual({ fire: true, isTriggered: true });
    expect(nextAlertState(true, satisfied)).toEqual({ fire: false, isTriggered: true });
  });

  it("re-arms when the condition clears", () => {
    expect(nextAlertState(true, notSatisfied)).toEqual({ fire: false, isTriggered: false });
  });

  it("leaves state unchanged without data", () => {
    expect(nextAlertState(true, { status: "insufficient_data", reason: "x" })).toEqual({ fire: false, isTriggered: true });
  });
});
