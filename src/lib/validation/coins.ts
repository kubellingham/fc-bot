/**
 * Parses a coin amount typed by a user. Coins are always whole numbers, so
 * separators are only ever thousands separators — unless a k/m suffix is used,
 * in which case one decimal separator is allowed ("1.5k", "1,25m").
 *
 *   "12000" "12,000" "12.000" "12 000" → 12000
 *   "12k" → 12000   "1.5m" → 1500000   "1,5m" → 1500000
 *
 * Returns null for anything else (negative numbers, fractions of a coin, junk).
 */
export function parseCoinInput(raw: string): number | null {
  const value = raw.trim().toLowerCase().replace(/[\s  _']/g, "");
  if (value === "") return null;

  const suffix = value.match(/^(\d+(?:[.,]\d+)?)([km])$/);
  if (suffix) {
    const base = Number(suffix[1].replace(",", "."));
    const multiplier = suffix[2] === "k" ? 1_000 : 1_000_000;
    const result = Math.round(base * multiplier * 1e6) / 1e6;
    return Number.isSafeInteger(result) ? result : null;
  }

  if (/^\d+$/.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : null;
  }

  if (/^\d{1,3}([.,]\d{3})+$/.test(value)) {
    const separators = new Set(value.replace(/\d/g, ""));
    if (separators.size !== 1) return null;
    const n = Number(value.replace(/[.,]/g, ""));
    return Number.isSafeInteger(n) ? n : null;
  }

  return null;
}

/** Parses a percentage like "12.5", "12,5" or "12.5%". */
export function parsePercentInput(raw: string): number | null {
  const value = raw.trim().replace(/%$/, "").replace(",", ".").trim();
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
