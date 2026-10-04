import { describe, expect, it } from "vitest";
import { parseCoinInput, parsePercentInput } from "./coins";

describe("parseCoinInput", () => {
  it.each([
    ["12000", 12_000],
    ["12,000", 12_000],
    ["12.000", 12_000],
    ["12 000", 12_000],
    ["1,234,567", 1_234_567],
    ["1.234.567", 1_234_567],
    ["12k", 12_000],
    ["12K", 12_000],
    ["1.5k", 1_500],
    ["1.5m", 1_500_000],
    ["1,25m", 1_250_000],
    ["0", 0],
    ["  950 ", 950],
  ])("parses %s", (input, expected) => {
    expect(parseCoinInput(input)).toBe(expected);
  });

  it.each(["", "-100", "12.5", "12,50", "1.2345k", "abc", "12kk", "1,234.567", "1e6", "0x10", "12.00.0"])(
    "rejects %s",
    (input) => {
      expect(parseCoinInput(input)).toBeNull();
    },
  );
});

describe("parsePercentInput", () => {
  it("accepts plain, comma-decimal and %-suffixed values", () => {
    expect(parsePercentInput("12.5")).toBe(12.5);
    expect(parsePercentInput("12,5")).toBe(12.5);
    expect(parsePercentInput("10%")).toBe(10);
  });

  it("rejects negatives and junk", () => {
    expect(parsePercentInput("-5")).toBeNull();
    expect(parsePercentInput("five")).toBeNull();
  });
});
