import { describe, expect, it } from "vitest";
import { checkHeaders, parseImportDate, parseRow } from "./definitions";
import { csvCell, toCsv } from "./write";

const NOW = Date.parse("2026-10-04T12:00:00Z");

describe("CSV writer", () => {
  it("quotes separators, quotes and newlines", () => {
    expect(csvCell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe("");
  });

  it("neutralises spreadsheet formulas in text but keeps negative numbers numeric", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-1400)).toBe("-1400");
  });

  it("writes a header, CRLF rows and a UTF-8 BOM", () => {
    const out = toCsv(["name", "price"], [{ name: "Mbappé", price: 1 }]);
    expect(out).toBe("﻿name,price\r\nMbappé,1\r\n");
  });
});

describe("import date parsing", () => {
  it("reads plain local times in the user's time zone", () => {
    expect(parseImportDate("2026-09-01 18:30", "Europe/London", NOW)).toEqual({ iso: "2026-09-01T17:30:00.000Z" });
    expect(parseImportDate("2026-09-01", "UTC", NOW)).toEqual({ iso: "2026-09-01T00:00:00.000Z" });
  });

  it("accepts ISO timestamps with an offset", () => {
    expect(parseImportDate("2026-09-01T18:30:00+02:00", "UTC", NOW)).toEqual({ iso: "2026-09-01T16:30:00.000Z" });
    expect(parseImportDate("2026-09-01T18:30:00Z", "Asia/Tokyo", NOW)).toEqual({ iso: "2026-09-01T18:30:00.000Z" });
  });

  it.each([
    ["01/09/2026", /must look like/],
    ["2026-13-01", /not a valid date/],
    ["1999-12-31", /after 2000/],
    ["2027-01-01", /future/],
    ["", /required/],
  ])("rejects %s", (value, message) => {
    const r = parseImportDate(value, "UTC", NOW);
    expect("error" in r && r.error).toMatch(message);
  });
});

describe("parseRow", () => {
  it("normalises a player row (case-insensitive headers, defaults)", () => {
    const { row, errors } = parseRow("players", { Name: " Kylian Mbappé ", Position: "st", Rating: "91" }, "UTC", NOW);
    expect(errors).toEqual([]);
    expect(row).toMatchObject({ player: { name: "Kylian Mbappé", version: "Base" }, position: "ST", rating: 91 });
  });

  it("collects every problem in an invalid row", () => {
    const { row, errors } = parseRow("players", { name: "", rating: "120", position: "XX" }, "UTC", NOW);
    expect(row).toBeNull();
    expect(errors).toEqual(["name is required", "rating must be a whole number from 1 to 99", expect.stringMatching(/^position must be one of/)]);
  });

  it("parses trades with an optional completed sale", () => {
    const open = parseRow("trades", { player: "A", quantity: "2", buy_price: "12.5k", bought_at: "2026-09-01 10:00" }, "UTC", NOW);
    expect(open.row).toMatchObject({ quantity: 2, buyPrice: 12_500, salePrice: null, soldAt: null });
    const sold = parseRow("trades", { player: "A", quantity: "1", buy_price: "100", bought_at: "2026-09-02", sale_price: "150", sold_at: "2026-09-01" }, "UTC", NOW);
    expect(sold.errors).toContain("sold_at is before bought_at");
    const half = parseRow("trades", { player: "A", quantity: "1", buy_price: "100", bought_at: "2026-09-01", sale_price: "150" }, "UTC", NOW);
    expect(half.errors).toContain("sold_at is required");
  });

  it("validates holdings and observations", () => {
    expect(parseRow("holdings", { player: "A", quantity: "0", unit_cost: "-5", acquired_at: "2026-09-01" }, "UTC", NOW).errors).toEqual([
      "quantity must be a whole number from 1 to 10000",
      "unit_cost must be a whole number of coins",
    ]);
    expect(parseRow("observations", { player: "A", version: "TOTW", price: "1,250,000", observed_at: "2026-09-01 12:00" }, "UTC", NOW).row).toMatchObject({
      player: { name: "A", version: "TOTW" },
      price: 1_250_000,
    });
  });
});

describe("checkHeaders", () => {
  it("lists missing required columns", () => {
    expect(checkHeaders("observations", ["Player", "price"])).toEqual(['Missing required column "observed_at".']);
    expect(checkHeaders("players", ["name"])).toEqual([]);
  });
});
