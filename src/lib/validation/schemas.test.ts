import { describe, expect, it } from "vitest";
import {
  alertSchema,
  observationSchema,
  playerSchema,
  saleSchema,
  settingsSchema,
  signUpSchema,
  tradeSchema,
  watchlistSchema,
} from "./schemas";

const PLAYER = "6f1d9a8e-2a4b-4c4e-9f00-1b2c3d4e5f60";
const LOT = "7a1d9a8e-2a4b-4c4e-9f00-1b2c3d4e5f60";
const iso = (d: string) => new Date(d).toISOString();

function errorsOf(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((i) => [i.path.join("."), i.message]));
}

describe("playerSchema", () => {
  it("normalises optional fields", () => {
    expect(playerSchema.parse({ name: "  Mbappé ", version: "", rating: "", position: "", club: "" })).toEqual({
      name: "Mbappé",
      version: "Base",
      rating: null,
      position: null,
      club: null,
      league: null,
      nation: null,
      rarity: null,
    });
  });

  it("validates rating and position", () => {
    const r = playerSchema.safeParse({ name: "X", rating: "120", position: "XX" });
    expect(Object.keys(errorsOf(r))).toEqual(expect.arrayContaining(["rating", "position"]));
  });

  it("requires a name", () => {
    expect(errorsOf(playerSchema.safeParse({ name: "   " }))).toHaveProperty("name", "Name is required.");
  });
});

describe("tradeSchema", () => {
  const base = { playerId: PLAYER, quantity: "2", unitCost: "12.5k", acquiredAt: iso("2026-09-01T10:00:00Z") };

  it("parses an open purchase with friendly coin input", () => {
    expect(tradeSchema.parse(base)).toMatchObject({ quantity: 2, unitCost: 12_500, sold: false, salePrice: null, soldAt: null });
  });

  it("requires sale details when marked as sold", () => {
    const errs = errorsOf(tradeSchema.safeParse({ ...base, sold: true }));
    expect(errs).toMatchObject({ salePrice: "Enter the sale price.", soldAt: "Enter when it sold." });
  });

  it("rejects a sale before the purchase", () => {
    const errs = errorsOf(
      tradeSchema.safeParse({ ...base, sold: true, salePrice: "15000", soldAt: iso("2026-08-01T00:00:00Z") }),
    );
    expect(errs.soldAt).toMatch(/before the purchase/);
  });

  it.each([
    [{ quantity: "0" }, "quantity"],
    [{ quantity: "1.5" }, "quantity"],
    [{ unitCost: "-5" }, "unitCost"],
    [{ unitCost: "16000000" }, "unitCost"],
    [{ acquiredAt: "yesterday" }, "acquiredAt"],
    [{ acquiredAt: iso("2999-01-01T00:00:00Z") }, "acquiredAt"],
    [{ playerId: "not-a-uuid" }, "playerId"],
  ])("rejects invalid input %o", (patch, field) => {
    expect(errorsOf(tradeSchema.safeParse({ ...base, ...patch }))).toHaveProperty(field);
  });

  it("allows zero-cost purchases (pack pulls)", () => {
    expect(tradeSchema.parse({ ...base, unitCost: "0" }).unitCost).toBe(0);
  });
});

describe("saleSchema", () => {
  const base = { quantity: 1, unitPrice: "15000", soldAt: iso("2026-09-02T00:00:00Z") };

  it("needs exactly one of tradeId or playerId", () => {
    expect(saleSchema.safeParse({ ...base, tradeId: LOT }).success).toBe(true);
    expect(saleSchema.safeParse({ ...base, playerId: PLAYER }).success).toBe(true);
    expect(saleSchema.safeParse(base).success).toBe(false);
    expect(saleSchema.safeParse({ ...base, tradeId: LOT, playerId: PLAYER }).success).toBe(false);
  });

  it("rejects a zero sale price", () => {
    expect(errorsOf(saleSchema.safeParse({ ...base, tradeId: LOT, unitPrice: "0" }))).toHaveProperty("unitPrice");
  });
});

describe("watchlistSchema", () => {
  it("requires the buy target to be below the sell target", () => {
    expect(watchlistSchema.safeParse({ playerId: PLAYER, targetBuyPrice: "10k", targetSellPrice: "9k" }).success).toBe(false);
    expect(watchlistSchema.parse({ playerId: PLAYER, targetBuyPrice: "", targetSellPrice: "9k" })).toMatchObject({
      targetBuyPrice: null,
      targetSellPrice: 9_000,
    });
  });
});

describe("observationSchema", () => {
  it("requires a positive price", () => {
    expect(observationSchema.safeParse({ playerId: PLAYER, price: "0", observedAt: iso("2026-09-01T00:00:00Z") }).success).toBe(false);
  });
});

describe("alertSchema", () => {
  it("parses price alerts as whole coins and drops percentage options", () => {
    expect(
      alertSchema.parse({ playerId: PLAYER, alertType: "price_below", targetValue: "9.5k", lookback: "24", direction: "up" }),
    ).toMatchObject({ targetValue: 9_500, lookbackHours: null, direction: "any" });
  });

  it("parses percentage alerts with a lookback", () => {
    expect(
      alertSchema.parse({ playerId: PLAYER, alertType: "pct_change", targetValue: "12,5%", lookback: "168", direction: "down" }),
    ).toMatchObject({ targetValue: 12.5, lookbackHours: 168, direction: "down" });
  });

  it("rejects out-of-range targets", () => {
    expect(alertSchema.safeParse({ playerId: PLAYER, alertType: "pct_change", targetValue: "0" }).success).toBe(false);
    expect(alertSchema.safeParse({ playerId: PLAYER, alertType: "price_above", targetValue: "10.5" }).success).toBe(false);
  });
});

describe("settingsSchema", () => {
  const base = {
    startingCoinBalance: "250k",
    taxRatePercent: "5",
    numberLocale: "en-GB",
    compactNumbers: false,
    theme: "dark",
    timezone: "Europe/London",
    alertNotifications: true,
  };

  it("parses valid settings", () => {
    expect(settingsSchema.parse(base)).toMatchObject({ startingCoinBalance: 250_000, taxRatePercent: 5, displayName: null });
  });

  it("rejects an invalid tax rate or time zone", () => {
    expect(settingsSchema.safeParse({ ...base, taxRatePercent: "100" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, taxRatePercent: "5.001" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, timezone: "Mars/Olympus" }).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("requires matching passwords of at least 8 characters", () => {
    expect(errorsOf(signUpSchema.safeParse({ email: "a@b.co", password: "short", confirmPassword: "short" }))).toHaveProperty(
      "password",
    );
    expect(
      errorsOf(signUpSchema.safeParse({ email: "a@b.co", password: "long-enough", confirmPassword: "different" })),
    ).toHaveProperty("confirmPassword", "Passwords do not match.");
    expect(signUpSchema.parse({ email: " A@B.CO ", password: "long-enough", confirmPassword: "long-enough" }).email).toBe("a@b.co");
  });
});
