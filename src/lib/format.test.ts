import { describe, expect, it } from "vitest";
import { coinSign, createFormatter } from "./format";

describe("createFormatter", () => {
  const f = createFormatter({ locale: "en-US", compact: false, timeZone: "UTC" });

  it("formats whole coins and rounds only for display", () => {
    expect(f.coins(1234567)).toBe("1,234,567");
    expect(f.coins(142.5)).toBe("143");
    expect(f.coins(-1000)).toBe("−1,000");
    expect(f.coins(null)).toBe("—");
    expect(f.coins(Number.NaN)).toBe("—");
  });

  it("signs coins and never shows a signed zero", () => {
    expect(f.signedCoins(1400)).toBe("+1,400");
    expect(f.signedCoins(-7250)).toBe("−7,250");
    expect(f.signedCoins(-0.4)).toBe("0");
  });

  it("supports compact notation and other locales", () => {
    expect(f.coins(1_250_000, { compact: true })).toBe("1.3M");
    expect(f.coins(9_999, { compact: true })).toBe("9,999");
    const de = createFormatter({ locale: "de-DE", compact: false, timeZone: "UTC" });
    expect(de.coins(1234567)).toBe("1.234.567");
  });

  it("formats percentages", () => {
    expect(f.percent(14)).toBe("14.0%");
    expect(f.signedPercent(-5)).toBe("−5.0%");
    expect(f.signedPercent(0.01)).toBe("0.0%");
    expect(f.percent(null)).toBe("—");
  });

  it("formats dates in the user's time zone", () => {
    const tokyo = createFormatter({ locale: "en-US", compact: false, timeZone: "Asia/Tokyo" });
    expect(f.date("2026-09-30T20:00:00Z")).toBe("Sep 30, 2026");
    expect(tokyo.date("2026-09-30T20:00:00Z")).toBe("Oct 1, 2026");
    expect(f.periodLabel("2026-10-04", "day")).toBe("Oct 4");
    expect(f.periodLabel("2026-10", "month")).toBe("Oct 2026");
  });

  it("formats relative times and durations", () => {
    const now = new Date("2026-10-04T12:00:00Z");
    expect(f.relative("2026-10-04T11:30:00Z", now)).toBe("30m ago");
    expect(f.relative("2026-10-01T12:00:00Z", now)).toBe("3d ago");
    expect(f.duration(0.5)).toBe("30m");
    expect(f.duration(42)).toBe("42h");
    expect(f.duration(100)).toBe("4d 4h");
  });
});

describe("coinSign", () => {
  it("uses the displayed (rounded) value", () => {
    expect(coinSign(0.4)).toBe(0);
    expect(coinSign(-0.6)).toBe(-1);
    expect(coinSign(null)).toBe(0);
  });
});
