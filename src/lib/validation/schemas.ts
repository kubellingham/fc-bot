import { z } from "zod";
import { MAX_COIN_BALANCE, MAX_QUANTITY, MAX_UNIT_PRICE } from "@/lib/finance/money";
import { isValidTimeZone } from "@/lib/finance/dates";
import { parseCoinInput, parsePercentInput } from "./coins";

/**
 * Canonical input schemas. Client forms use them for instant feedback and every
 * Server Action parses its input with the same schema again — the client is
 * never trusted. Numeric fields accept strings (form inputs) or numbers.
 */

export const POSITIONS = ["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"] as const;
export const NUMBER_LOCALES = ["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "it-IT", "nl-NL", "pt-BR"] as const;
export const THEMES = ["system", "dark", "light"] as const;

/** Allow a little clock skew when rejecting future dates. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;
const EARLIEST = Date.parse("2000-01-01T00:00:00Z");

export const uuid = z.uuid("Invalid identifier.");

function coins(label: string, { min = 0, max = MAX_UNIT_PRICE }: { min?: number; max?: number } = {}) {
  return z.union([z.string(), z.number()]).transform((value, ctx) => {
    const n = typeof value === "number" ? value : parseCoinInput(value);
    if (n === null || !Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: `Enter ${label} as a whole number of coins (e.g. 12500 or 12.5k).` });
      return z.NEVER;
    }
    if (!Number.isInteger(n)) {
      ctx.addIssue({ code: "custom", message: `${capitalize(label)} must be a whole number of coins.` });
      return z.NEVER;
    }
    if (n < min) {
      ctx.addIssue({ code: "custom", message: `${capitalize(label)} must be at least ${min.toLocaleString("en-US")}.` });
      return z.NEVER;
    }
    if (n > max) {
      ctx.addIssue({ code: "custom", message: `${capitalize(label)} cannot exceed ${max.toLocaleString("en-US")}.` });
      return z.NEVER;
    }
    return n;
  });
}

/** An optional coin field: empty string / null / undefined → null. */
function optionalCoins(label: string, opts?: { min?: number; max?: number }) {
  return z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v))
    .pipe(z.union([z.null(), coins(label, opts)]));
}

function integer(label: string, min: number, max: number) {
  return z.union([z.string(), z.number()]).transform((value, ctx) => {
    const n = typeof value === "number" ? value : value.trim() === "" ? Number.NaN : Number(value.trim());
    if (!Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: `${capitalize(label)} must be a whole number between ${min} and ${max.toLocaleString("en-US")}.` });
      return z.NEVER;
    }
    return n;
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** ISO-8601 timestamp with an explicit offset; not before 2000 and not in the future. */
export const pastDateTime = z
  .string({ error: "Enter a date and time." })
  .min(1, "Enter a date and time.")
  .refine((s) => z.iso.datetime({ offset: true }).safeParse(s).success, "Enter a valid date and time.")
  .refine((s) => Date.parse(s) >= EARLIEST, "Date must be after 1 January 2000.")
  .refine((s) => Date.parse(s) <= Date.now() + FUTURE_TOLERANCE_MS, "Date cannot be in the future.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${capitalize(label)} is required.` })
    .trim()
    .min(1, `${capitalize(label)} is required.`)
    .max(max, `${capitalize(label)} must be at most ${max} characters.`);

// --------------------------------------------------------------------------
// Players
// --------------------------------------------------------------------------
export const playerSchema = z.object({
  name: requiredText("name", 80),
  version: z
    .string()
    .trim()
    .max(40, "Version must be at most 40 characters.")
    .optional()
    .transform((v) => (v ? v : "Base")),
  rating: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v))
    .pipe(z.union([z.null(), integer("rating", 1, 99)])),
  position: z
    .union([z.enum(POSITIONS), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  club: optionalText(60),
  league: optionalText(60),
  nation: optionalText(60),
  rarity: optionalText(40),
});
export type PlayerInput = z.input<typeof playerSchema>;
export type PlayerValues = z.output<typeof playerSchema>;

// --------------------------------------------------------------------------
// Trades (purchases), optionally recorded together with a completed sale
// --------------------------------------------------------------------------
export const tradeSchema = z
  .object({
    playerId: uuid,
    quantity: integer("quantity", 1, MAX_QUANTITY),
    unitCost: coins("purchase price"),
    acquiredAt: pastDateTime,
    notes: optionalText(1000),
    sold: z.boolean().default(false),
    salePrice: optionalCoins("sale price", { min: 1 }),
    soldAt: z
      .union([pastDateTime, z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((v, ctx) => {
    if (!v.sold) return;
    if (v.salePrice === null) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Enter the sale price." });
    if (v.soldAt === null) ctx.addIssue({ code: "custom", path: ["soldAt"], message: "Enter when it sold." });
    if (v.soldAt && Date.parse(v.soldAt) < Date.parse(v.acquiredAt)) {
      ctx.addIssue({ code: "custom", path: ["soldAt"], message: "The sale cannot be before the purchase." });
    }
  });
export type TradeInput = z.input<typeof tradeSchema>;

export const tradeUpdateSchema = z.object({
  id: uuid,
  playerId: uuid,
  quantity: integer("quantity", 1, MAX_QUANTITY),
  unitCost: coins("purchase price"),
  acquiredAt: pastDateTime,
  notes: optionalText(1000),
});
export type TradeUpdateInput = z.input<typeof tradeUpdateSchema>;

/** Sell from one lot (tradeId) or from a player's holding using FIFO (playerId). */
export const saleSchema = z
  .object({
    tradeId: uuid.optional(),
    playerId: uuid.optional(),
    quantity: integer("quantity", 1, MAX_QUANTITY),
    unitPrice: coins("sale price", { min: 1 }),
    soldAt: pastDateTime,
    notes: optionalText(1000),
  })
  .refine((v) => Boolean(v.tradeId) !== Boolean(v.playerId), {
    message: "Choose what you sold.",
    path: ["tradeId"],
  });
export type SaleInput = z.input<typeof saleSchema>;

// --------------------------------------------------------------------------
// Prices, watchlist and alerts
// --------------------------------------------------------------------------
export const observationSchema = z.object({
  playerId: uuid,
  price: coins("price", { min: 1 }),
  observedAt: pastDateTime,
  notes: optionalText(500),
});
export type ObservationInput = z.input<typeof observationSchema>;

export const watchlistSchema = z
  .object({
    playerId: uuid,
    targetBuyPrice: optionalCoins("target buy price", { min: 1 }),
    targetSellPrice: optionalCoins("target sell price", { min: 1 }),
    notes: optionalText(500),
  })
  .refine(
    (v) => v.targetBuyPrice === null || v.targetSellPrice === null || v.targetBuyPrice < v.targetSellPrice,
    { message: "The buy target must be below the sell target.", path: ["targetSellPrice"] },
  );
export type WatchlistInput = z.input<typeof watchlistSchema>;

export const LOOKBACK_OPTIONS = [
  { value: "previous", label: "Since previous observation", hours: null },
  { value: "24", label: "Over 24 hours", hours: 24 },
  { value: "168", label: "Over 7 days", hours: 168 },
  { value: "720", label: "Over 30 days", hours: 720 },
] as const;

export const alertSchema = z
  .object({
    playerId: uuid,
    alertType: z.enum(["price_below", "price_above", "pct_change"], { error: "Choose an alert type." }),
    targetValue: z.union([z.string(), z.number()]),
    lookback: z.enum(["previous", "24", "168", "720"]).default("previous"),
    direction: z.enum(["any", "up", "down"]).default("any"),
    note: optionalText(200),
  })
  .transform((v, ctx) => {
    let target: number | null;
    if (v.alertType === "pct_change") {
      target = typeof v.targetValue === "number" ? v.targetValue : parsePercentInput(v.targetValue);
      if (target === null || target <= 0 || target > 1000 || Math.round(target * 100) !== target * 100) {
        ctx.addIssue({ code: "custom", path: ["targetValue"], message: "Enter a percentage between 0.01 and 1000." });
        return z.NEVER;
      }
    } else {
      target = typeof v.targetValue === "number" ? v.targetValue : parseCoinInput(v.targetValue);
      if (target === null || !Number.isInteger(target) || target < 1 || target > MAX_UNIT_PRICE) {
        ctx.addIssue({ code: "custom", path: ["targetValue"], message: "Enter a price between 1 and 15,000,000 coins." });
        return z.NEVER;
      }
    }
    const isPct = v.alertType === "pct_change";
    return {
      playerId: v.playerId,
      alertType: v.alertType,
      targetValue: target,
      lookbackHours: isPct && v.lookback !== "previous" ? Number(v.lookback) : null,
      direction: isPct ? v.direction : ("any" as const),
      note: v.note,
    };
  });
export type AlertInput = z.input<typeof alertSchema>;

// --------------------------------------------------------------------------
// Coins and settings
// --------------------------------------------------------------------------
export const adjustmentSchema = z.object({
  direction: z.enum(["credit", "debit"]),
  amount: coins("amount", { min: 1, max: MAX_COIN_BALANCE }),
  reason: requiredText("reason", 200),
  occurredAt: pastDateTime,
});
export type AdjustmentInput = z.input<typeof adjustmentSchema>;

export const reconcileSchema = z.object({
  actualBalance: coins("in-game balance", { max: MAX_COIN_BALANCE }),
});

export const settingsSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(60, "Display name must be at most 60 characters.")
    .optional()
    .transform((v) => (v ? v : null)),
  startingCoinBalance: coins("starting balance", { max: MAX_COIN_BALANCE }),
  taxRatePercent: z.union([z.string(), z.number()]).transform((v, ctx) => {
    const n = typeof v === "number" ? v : parsePercentInput(v);
    if (n === null || n < 0 || n >= 100 || Math.round(n * 100) !== n * 100) {
      ctx.addIssue({ code: "custom", message: "Enter a tax rate between 0 and 99.99%." });
      return z.NEVER;
    }
    return n;
  }),
  numberLocale: z.enum(NUMBER_LOCALES),
  compactNumbers: z.boolean(),
  theme: z.enum(THEMES),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone."),
  alertNotifications: z.boolean(),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export const themeSchema = z.enum(THEMES);

// --------------------------------------------------------------------------
// Authentication
// --------------------------------------------------------------------------
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")).pipe(z.string().max(254));
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

export const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password.").max(72) });
export const signUpSchema = z
  .object({ email, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });
export const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE", { error: 'Type "DELETE" to confirm.' }),
});

// --------------------------------------------------------------------------
// AI analyst
// --------------------------------------------------------------------------
export const aiQuestionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Ask a slightly longer question.")
    .max(500, "Keep questions under 500 characters."),
});
