import { roundCoins } from "@/lib/finance/money";

export interface FormatPrefs {
  locale: string;
  compact: boolean;
  timeZone: string;
}

export const DEFAULT_FORMAT_PREFS: FormatPrefs = { locale: "en-US", compact: false, timeZone: "UTC" };

const MINUS = "−";
const DASH = "—";

export interface Formatter {
  prefs: FormatPrefs;
  /** Whole coins, e.g. "12,500" (or "12.5K" when compact). */
  coins(value: number | null | undefined, opts?: { compact?: boolean }): string;
  /** Signed coins, e.g. "+1,400" / "−1,000". Zero has no sign. */
  signedCoins(value: number | null | undefined, opts?: { compact?: boolean }): string;
  percent(value: number | null | undefined, digits?: number): string;
  signedPercent(value: number | null | undefined, digits?: number): string;
  number(value: number | null | undefined, digits?: number): string;
  date(iso: string | null | undefined): string;
  dateTime(iso: string | null | undefined): string;
  /** Formats a "YYYY-MM-DD" / "YYYY-MM" period key (already in the user's zone). */
  periodLabel(key: string, granularity: "day" | "week" | "month"): string;
  relative(iso: string | null | undefined, now?: Date): string;
  duration(hours: number | null | undefined): string;
}

export function createFormatter(prefs: FormatPrefs = DEFAULT_FORMAT_PREFS): Formatter {
  const locale = safeLocale(prefs.locale);
  const timeZone = prefs.timeZone || "UTC";
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const compactFmt = new Intl.NumberFormat(locale, { notation: "compact", maximumSignificantDigits: 3 });
  const dateFmt = new Intl.DateTimeFormat(locale, { timeZone, year: "numeric", month: "short", day: "numeric" });
  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayFmt = new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "short", day: "numeric" });
  const monthFmt = new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "short", year: "numeric" });
  const percentCache = new Map<number, Intl.NumberFormat>();
  const pct = (digits: number) => {
    let f = percentCache.get(digits);
    if (!f) {
      f = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
      percentCache.set(digits, f);
    }
    return f;
  };

  const coins = (value: number | null | undefined, opts?: { compact?: boolean }) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
    const rounded = roundCoins(value);
    const useCompact = (opts?.compact ?? prefs.compact) && Math.abs(rounded) >= 10_000;
    const text = (useCompact ? compactFmt : whole).format(Math.abs(rounded));
    return rounded < 0 ? `${MINUS}${text}` : text;
  };

  return {
    prefs: { locale, compact: prefs.compact, timeZone },
    coins,
    signedCoins(value, opts) {
      if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
      const rounded = roundCoins(value);
      if (rounded === 0) return coins(0, opts);
      return rounded > 0 ? `+${coins(rounded, opts)}` : coins(rounded, opts);
    },
    percent(value, digits = 1) {
      if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
      const text = pct(digits).format(Math.abs(value));
      return `${value < 0 && Number(text.replace(/[^\d]/g, "")) !== 0 ? MINUS : ""}${text}%`;
    },
    signedPercent(value, digits = 1) {
      if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
      const text = pct(digits).format(Math.abs(value));
      if (Number(text.replace(/[^\d]/g, "")) === 0) return `${text}%`;
      return `${value > 0 ? "+" : MINUS}${text}%`;
    },
    number(value, digits = 0) {
      if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
      return pct(digits).format(value);
    },
    date(iso) {
      if (!iso) return DASH;
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? DASH : dateFmt.format(d);
    },
    dateTime(iso) {
      if (!iso) return DASH;
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? DASH : dateTimeFmt.format(d);
    },
    periodLabel(key, granularity) {
      const [y, m, d] = key.split("-").map(Number);
      const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
      if (granularity === "month") return monthFmt.format(date);
      return dayFmt.format(date);
    },
    relative(iso, now = new Date()) {
      if (!iso) return DASH;
      const diffMs = now.getTime() - new Date(iso).getTime();
      if (!Number.isFinite(diffMs)) return DASH;
      const future = diffMs < 0;
      const mins = Math.round(Math.abs(diffMs) / 60_000);
      let text: string;
      if (mins < 1) return "just now";
      if (mins < 60) text = `${mins}m`;
      else if (mins < 60 * 24) text = `${Math.round(mins / 60)}h`;
      else if (mins < 60 * 24 * 60) text = `${Math.round(mins / 1440)}d`;
      else text = `${Math.round(mins / 43_200)}mo`;
      return future ? `in ${text}` : `${text} ago`;
    },
    duration(hours) {
      if (hours === null || hours === undefined || !Number.isFinite(hours)) return DASH;
      if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
      if (hours < 48) return `${Math.round(hours)}h`;
      const days = Math.floor(hours / 24);
      const rem = Math.round(hours - days * 24);
      return rem === 0 ? `${days}d` : `${days}d ${rem}h`;
    },
  };
}

function safeLocale(locale: string): string {
  try {
    return Intl.NumberFormat.supportedLocalesOf([locale]).length ? locale : "en-US";
  } catch {
    return "en-US";
  }
}

/** -1, 0 or 1 after rounding to whole coins, so "−0" never shows as a loss. */
export function coinSign(value: number | null | undefined): -1 | 0 | 1 {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  const r = roundCoins(value);
  return r > 0 ? 1 : r < 0 ? -1 : 0;
}
