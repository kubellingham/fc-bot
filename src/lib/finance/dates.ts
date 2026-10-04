/**
 * Calendar bucketing in a user's IANA time zone. Keys are plain strings that
 * sort chronologically: days "YYYY-MM-DD", weeks by their Monday "YYYY-MM-DD",
 * months "YYYY-MM".
 */

export type Granularity = "day" | "week" | "month";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

interface YMD {
  year: number;
  month: number; // 1-12
  day: number;
}

function localParts(instant: string | Date, timeZone: string): YMD {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid date: ${String(instant)}`);
  const parts = formatterFor(timeZone).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
const ymdKey = ({ year, month, day }: YMD) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

function utcFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function keyFromUtc(date: Date): string {
  return ymdKey({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
}

export function dayKey(instant: string | Date, timeZone: string): string {
  return ymdKey(localParts(instant, timeZone));
}

/** ISO weeks start on Monday; the key is that Monday's date. */
export function weekKey(instant: string | Date, timeZone: string): string {
  return mondayOf(dayKey(instant, timeZone));
}

function mondayOf(day: string): string {
  const date = utcFromKey(day);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return keyFromUtc(date);
}

export function monthKey(instant: string | Date, timeZone: string): string {
  const { year, month } = localParts(instant, timeZone);
  return `${pad(year, 4)}-${pad(month)}`;
}

export function periodKey(instant: string | Date, granularity: Granularity, timeZone: string): string {
  switch (granularity) {
    case "day":
      return dayKey(instant, timeZone);
    case "week":
      return weekKey(instant, timeZone);
    case "month":
      return monthKey(instant, timeZone);
  }
}

/** Every period key from the period containing `start` to the one containing `end`, inclusive. */
export function enumeratePeriods(
  start: string | Date,
  end: string | Date,
  granularity: Granularity,
  timeZone: string,
  maxPeriods = 1000,
): string[] {
  const first = periodKey(start, granularity, timeZone);
  const last = periodKey(end, granularity, timeZone);
  if (first > last) return [];
  const keys: string[] = [];

  if (granularity === "month") {
    let [y, m] = first.split("-").map(Number);
    let key = first;
    while (key <= last && keys.length < maxPeriods) {
      keys.push(key);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      key = `${pad(y, 4)}-${pad(m)}`;
    }
    return keys;
  }

  const step = granularity === "week" ? 7 : 1;
  const cursor = utcFromKey(first);
  let key = first;
  while (key <= last && keys.length < maxPeriods) {
    keys.push(key);
    cursor.setUTCDate(cursor.getUTCDate() + step);
    key = keyFromUtc(cursor);
  }
  return keys;
}

/** Whole days between two instants, as a fraction (used for holding periods and trends). */
export function daysBetween(from: string | Date, to: string | Date): number {
  const a = typeof from === "string" ? Date.parse(from) : from.getTime();
  const b = typeof to === "string" ? Date.parse(to) : to.getTime();
  return (b - a) / 86_400_000;
}
