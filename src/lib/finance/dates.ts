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

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Converts a wall-clock time in `timeZone` to a UTC instant. For times skipped
 * by a DST change the result moves forward by the gap; for repeated times the
 * earlier instant is used.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const HALF_DAY = 12 * 3_600_000;
  // Candidate instants using the offsets in force well before and well after any nearby transition.
  const before = wall - zoneOffsetMs(wall - HALF_DAY, timeZone);
  const after = wall - zoneOffsetMs(wall + HALF_DAY, timeZone);
  const valid = [before, after].filter((c) => c + zoneOffsetMs(c, timeZone) === wall);
  // Repeated time → earliest valid instant. Skipped time (no valid candidate) → shift forward by the gap.
  return new Date(valid.length > 0 ? Math.min(...valid) : before);
}
