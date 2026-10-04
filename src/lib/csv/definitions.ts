import { z } from "zod";
import { zonedTimeToUtc } from "@/lib/finance/dates";
import { MAX_QUANTITY, MAX_UNIT_PRICE } from "@/lib/finance/money";
import { parseCoinInput } from "@/lib/validation/coins";
import { POSITIONS } from "@/lib/validation/schemas";

/**
 * CSV import definitions: columns, per-row validation and normalisation.
 * Pure functions — the same code validates the preview and the commit.
 */

export const IMPORT_ENTITIES = ["players", "holdings", "trades", "observations"] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

export const MAX_IMPORT_ROWS = 5000;

export const IMPORT_COLUMNS: Record<ImportEntity, { required: string[]; optional: string[]; example: string[] }> = {
  players: {
    required: ["name"],
    optional: ["version", "rating", "position", "club", "league", "nation", "rarity"],
    example: ["Kylian Mbappé", "TOTW", "92", "ST", "Real Madrid", "LALIGA EA SPORTS", "France", "Rare"],
  },
  holdings: {
    required: ["player", "quantity", "unit_cost", "acquired_at"],
    optional: ["version", "notes"],
    example: ["Kylian Mbappé", "1", "1250000", "2026-09-01 18:30", "TOTW", ""],
  },
  trades: {
    required: ["player", "quantity", "buy_price", "bought_at"],
    optional: ["version", "sale_price", "sold_at", "notes"],
    example: ["Kylian Mbappé", "1", "1250000", "2026-09-01 18:30", "TOTW", "1400000", "2026-09-03 20:00", "Promo flip"],
  },
  observations: {
    required: ["player", "price", "observed_at"],
    optional: ["version", "notes"],
    example: ["Kylian Mbappé", "1310000", "2026-09-02 12:00", "TOTW", "Lowest BIN"],
  },
};

export type RawRow = Record<string, string>;

const MIN_DATE = Date.parse("2000-01-01T00:00:00Z");

/**
 * Accepts ISO-8601 with an offset ("2026-09-01T18:30:00Z") or a plain local
 * date/time ("2026-09-01 18:30", "2026-09-01") interpreted in `timeZone`.
 */
export function parseImportDate(value: string, timeZone: string, now = Date.now()): { iso: string } | { error: string } {
  const v = value.trim();
  if (!v) return { error: "is required" };
  let instant: number;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v) && /^\d{4}-\d{2}-\d{2}[T ]/.test(v)) {
    instant = Date.parse(v.replace(" ", "T"));
  } else {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
    if (!m) return { error: "must look like 2026-09-01 18:30 or an ISO timestamp" };
    const [y, mo, d, h = "0", mi = "0"] = m.slice(1);
    if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || Number(h) > 23 || Number(mi) > 59) {
      return { error: "is not a valid date" };
    }
    instant = zonedTimeToUtc(Number(y), Number(mo), Number(d), Number(h), Number(mi), timeZone).getTime();
  }
  if (!Number.isFinite(instant)) return { error: "is not a valid date" };
  if (instant < MIN_DATE) return { error: "must be after 2000-01-01" };
  if (instant > now + 5 * 60_000) return { error: "cannot be in the future" };
  return { iso: new Date(instant).toISOString() };
}

function coinsField(value: string | undefined, label: string, min: number, errors: string[]): number | null {
  const n = parseCoinInput(value ?? "");
  if (n === null) {
    errors.push(`${label} must be a whole number of coins`);
    return null;
  }
  if (n < min || n > MAX_UNIT_PRICE) {
    errors.push(`${label} must be between ${min} and ${MAX_UNIT_PRICE.toLocaleString("en-US")}`);
    return null;
  }
  return n;
}

function quantityField(value: string | undefined, errors: string[]): number | null {
  const n = Number((value ?? "").trim());
  if (!Number.isInteger(n) || n < 1 || n > MAX_QUANTITY) {
    errors.push(`quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
    return null;
  }
  return n;
}

function textField(value: string | undefined, label: string, max: number, errors: string[]): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.length > max) {
    errors.push(`${label} is longer than ${max} characters`);
    return null;
  }
  return v;
}

export interface PlayerRef {
  name: string;
  version: string;
}

export const playerKey = (p: PlayerRef) => `${p.name.trim().toLowerCase()}\u0000${(p.version.trim() || "Base").toLowerCase()}`;

function playerRef(row: RawRow, errors: string[]): PlayerRef | null {
  const name = (row.player ?? "").trim();
  if (!name) {
    errors.push("player is required");
    return null;
  }
  if (name.length > 80) {
    errors.push("player is longer than 80 characters");
    return null;
  }
  const version = (row.version ?? "").trim() || "Base";
  if (version.length > 40) {
    errors.push("version is longer than 40 characters");
    return null;
  }
  return { name, version };
}

export type ParsedRow =
  | { entity: "players"; player: PlayerRef; rating: number | null; position: string | null; club: string | null; league: string | null; nation: string | null; rarity: string | null }
  | { entity: "holdings"; player: PlayerRef; quantity: number; unitCost: number; acquiredAt: string; notes: string | null }
  | { entity: "trades"; player: PlayerRef; quantity: number; buyPrice: number; boughtAt: string; salePrice: number | null; soldAt: string | null; notes: string | null }
  | { entity: "observations"; player: PlayerRef; price: number; observedAt: string; notes: string | null };

/** Validates and normalises one CSV row. Header names are matched case-insensitively. */
export function parseRow(entity: ImportEntity, input: RawRow, timeZone: string, now = Date.now()): { row: ParsedRow | null; errors: string[] } {
  const row: RawRow = {};
  for (const [k, v] of Object.entries(input)) row[k.trim().toLowerCase().replace(/\s+/g, "_")] = typeof v === "string" ? v : String(v ?? "");
  const errors: string[] = [];
  const date = (key: string, label: string) => {
    const r = parseImportDate(row[key] ?? "", timeZone, now);
    if ("error" in r) {
      errors.push(`${label} ${r.error}`);
      return null;
    }
    return r.iso;
  };

  switch (entity) {
    case "players": {
      const name = (row.name ?? "").trim();
      if (!name) errors.push("name is required");
      else if (name.length > 80) errors.push("name is longer than 80 characters");
      const version = (row.version ?? "").trim() || "Base";
      if (version.length > 40) errors.push("version is longer than 40 characters");
      let rating: number | null = null;
      if ((row.rating ?? "").trim()) {
        rating = Number(row.rating.trim());
        if (!Number.isInteger(rating) || rating < 1 || rating > 99) {
          errors.push("rating must be a whole number from 1 to 99");
          rating = null;
        }
      }
      let position: string | null = (row.position ?? "").trim().toUpperCase() || null;
      if (position && !(POSITIONS as readonly string[]).includes(position)) {
        errors.push(`position must be one of ${POSITIONS.join(", ")}`);
        position = null;
      }
      const club = textField(row.club, "club", 60, errors);
      const league = textField(row.league, "league", 60, errors);
      const nation = textField(row.nation, "nation", 60, errors);
      const rarity = textField(row.rarity, "rarity", 40, errors);
      if (errors.length) return { row: null, errors };
      return { row: { entity, player: { name, version }, rating, position, club, league, nation, rarity }, errors };
    }
    case "holdings": {
      const player = playerRef(row, errors);
      const quantity = quantityField(row.quantity, errors);
      const unitCost = coinsField(row.unit_cost, "unit_cost", 0, errors);
      const acquiredAt = date("acquired_at", "acquired_at");
      const notes = textField(row.notes, "notes", 1000, errors);
      if (errors.length || !player || quantity === null || unitCost === null || !acquiredAt) return { row: null, errors };
      return { row: { entity, player, quantity, unitCost, acquiredAt, notes }, errors };
    }
    case "trades": {
      const player = playerRef(row, errors);
      const quantity = quantityField(row.quantity, errors);
      const buyPrice = coinsField(row.buy_price, "buy_price", 0, errors);
      const boughtAt = date("bought_at", "bought_at");
      const hasSale = Boolean((row.sale_price ?? "").trim() || (row.sold_at ?? "").trim());
      let salePrice: number | null = null;
      let soldAt: string | null = null;
      if (hasSale) {
        salePrice = coinsField(row.sale_price, "sale_price", 1, errors);
        soldAt = date("sold_at", "sold_at");
        if (soldAt && boughtAt && Date.parse(soldAt) < Date.parse(boughtAt)) errors.push("sold_at is before bought_at");
      }
      const notes = textField(row.notes, "notes", 1000, errors);
      if (errors.length || !player || quantity === null || buyPrice === null || !boughtAt) return { row: null, errors };
      return { row: { entity, player, quantity, buyPrice, boughtAt, salePrice, soldAt, notes }, errors };
    }
    case "observations": {
      const player = playerRef(row, errors);
      const price = coinsField(row.price, "price", 1, errors);
      const observedAt = date("observed_at", "observed_at");
      const notes = textField(row.notes, "notes", 500, errors);
      if (errors.length || !player || price === null || !observedAt) return { row: null, errors };
      return { row: { entity, player, price, observedAt, notes }, errors };
    }
  }
}

/** Header problems that make a whole file unusable. */
export function checkHeaders(entity: ImportEntity, headers: string[]): string[] {
  const present = new Set(headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_")));
  return IMPORT_COLUMNS[entity].required.filter((c) => !present.has(c)).map((c) => `Missing required column "${c}".`);
}

export const importRequestSchema = z.object({
  entity: z.enum(IMPORT_ENTITIES),
  rows: z.array(z.record(z.string(), z.string().max(2000))).min(1, "The file has no data rows.").max(MAX_IMPORT_ROWS, `Import at most ${MAX_IMPORT_ROWS} rows at a time.`),
  headers: z.array(z.string().max(100)).max(50),
  createMissingPlayers: z.boolean().default(false),
});
export type ImportRequest = z.input<typeof importRequestSchema>;
