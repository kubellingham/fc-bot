import type { Database } from "@/lib/supabase/database.types";
import type { Adjustment, Alert, AlertEvent, Observation, Player, Sale, Settings, Trade, WatchlistItem } from "@/lib/domain";
import { DEFAULT_SETTINGS } from "@/lib/domain";
import type { AlertDirection, AlertType } from "@/lib/finance/alerts";

type Tables = Database["public"]["Tables"];
type Row<T extends keyof Tables> = Tables[T]["Row"];

/** PostgREST returns numeric columns as numbers; this guards against strings from older servers. */
const num = (v: number | string): number => (typeof v === "number" ? v : Number(v));

export const toPlayer = (r: Row<"players">): Player => ({
  id: r.id,
  name: r.name,
  version: r.version,
  rating: r.rating,
  position: r.position,
  club: r.club,
  league: r.league,
  nation: r.nation,
  rarity: r.rarity,
  createdAt: r.created_at,
});

export const toTrade = (r: Row<"trades">): Trade => ({
  id: r.id,
  playerId: r.player_id,
  quantity: r.quantity,
  unitCost: num(r.unit_cost),
  acquiredAt: r.acquired_at,
  notes: r.notes,
  createdAt: r.created_at,
});

export const toSale = (r: Row<"trade_sales">): Sale => ({
  id: r.id,
  tradeId: r.trade_id,
  quantity: r.quantity,
  unitPrice: num(r.unit_price),
  taxRate: num(r.tax_rate),
  soldAt: r.sold_at,
  notes: r.notes,
});

export const toObservation = (r: Row<"price_observations">): Observation => ({
  id: r.id,
  playerId: r.player_id,
  price: num(r.price),
  observedAt: r.observed_at,
  source: r.source === "import" ? "import" : "manual",
  notes: r.notes,
  createdAt: r.created_at,
});

export const toWatchlistItem = (r: Row<"watchlist_items">): WatchlistItem => ({
  id: r.id,
  playerId: r.player_id,
  targetBuyPrice: r.target_buy_price === null ? null : num(r.target_buy_price),
  targetSellPrice: r.target_sell_price === null ? null : num(r.target_sell_price),
  notes: r.notes,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
});

export const toAlert = (r: Row<"alerts">): Alert => ({
  id: r.id,
  playerId: r.player_id,
  type: r.alert_type as AlertType,
  targetValue: num(r.target_value),
  lookbackHours: r.lookback_hours,
  direction: r.direction as AlertDirection,
  isActive: r.is_active,
  isTriggered: r.is_triggered,
  lastTriggeredAt: r.last_triggered_at,
  note: r.note,
  createdAt: r.created_at,
});

export const toAlertEvent = (r: Row<"alert_events">): AlertEvent => ({
  id: r.id,
  alertId: r.alert_id,
  observationId: r.observation_id,
  observedPrice: num(r.observed_price),
  message: r.message,
  triggeredAt: r.triggered_at,
  readAt: r.read_at,
});

export const toAdjustment = (r: Row<"coin_adjustments">): Adjustment => ({
  id: r.id,
  amount: num(r.amount),
  reason: r.reason,
  occurredAt: r.occurred_at,
});

export function toSettings(row: Row<"user_settings"> | null, profile: Row<"profiles"> | null): Settings {
  if (!row) return { ...DEFAULT_SETTINGS, displayName: profile?.display_name ?? null };
  return {
    displayName: profile?.display_name ?? null,
    startingCoinBalance: num(row.starting_coin_balance),
    taxRate: num(row.tax_rate),
    numberLocale: row.number_locale,
    compactNumbers: row.compact_numbers,
    theme: row.theme === "dark" || row.theme === "light" ? row.theme : "system",
    timezone: row.timezone,
    alertNotifications: row.alert_notifications,
    persisted: true,
  };
}
