import "server-only";
import { cache } from "react";
import type { Adjustment, Alert, AlertEvent, Observation, Player, Sale, Settings, Trade, WatchlistItem } from "@/lib/domain";
import {
  buildHoldings,
  computePortfolioSummary,
  summarizeLots,
  type Holding,
  type LatestPrice,
  type LotSummary,
  type PortfolioSummary,
} from "@/lib/finance";
import { requireAuth } from "./auth";
import { DataLoadError, fetchAll } from "./fetch-all";

export { DataLoadError };
import {
  toAdjustment,
  toAlert,
  toAlertEvent,
  toObservation,
  toPlayer,
  toSale,
  toSettings,
  toTrade,
  toWatchlistItem,
} from "./mappers";

/**
 * Read models for pages. Every query runs as the signed-in user (RLS applies)
 * and is memoised per request with React `cache`, so a page and its children
 * can ask for the same data without extra round trips.
 */

export const getSettings = cache(async (): Promise<Settings> => {
  const { supabase, user } = await requireAuth();
  const [settings, profile] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);
  if (settings.error) throw new DataLoadError("settings", settings.error.code);
  if (profile.error) throw new DataLoadError("profile", profile.error.code);
  return toSettings(settings.data, profile.data);
});

export const getPlayers = cache(async (): Promise<Player[]> => {
  const { supabase } = await requireAuth();
  const rows = await fetchAll("players", (from, to) =>
    supabase.from("players").select("*").order("name").order("version").order("id").range(from, to),
  );
  return rows.map(toPlayer);
});

export const getPlayerMap = cache(async (): Promise<Map<string, Player>> => {
  return new Map((await getPlayers()).map((p) => [p.id, p]));
});

export const getTrades = cache(async (): Promise<Trade[]> => {
  const { supabase } = await requireAuth();
  const rows = await fetchAll("trades", (from, to) =>
    supabase.from("trades").select("*").order("acquired_at", { ascending: false }).order("id").range(from, to),
  );
  return rows.map(toTrade);
});

export const getSales = cache(async (): Promise<Sale[]> => {
  const { supabase } = await requireAuth();
  const rows = await fetchAll("sales", (from, to) =>
    supabase.from("trade_sales").select("*").order("sold_at", { ascending: false }).order("id").range(from, to),
  );
  return rows.map(toSale);
});

export const getAdjustments = cache(async (): Promise<Adjustment[]> => {
  const { supabase } = await requireAuth();
  const rows = await fetchAll("coin adjustments", (from, to) =>
    supabase.from("coin_adjustments").select("*").order("occurred_at", { ascending: false }).order("id").range(from, to),
  );
  return rows.map(toAdjustment);
});

export const getLatestPrices = cache(async (): Promise<Map<string, LatestPrice>> => {
  const { supabase } = await requireAuth();
  const rows = await fetchAll("latest prices", (from, to) =>
    supabase.from("latest_price_observations").select("player_id, price, observed_at").order("player_id").range(from, to),
  );
  const map = new Map<string, LatestPrice>();
  for (const r of rows) {
    if (r.player_id && r.price !== null && r.observed_at) {
      map.set(r.player_id, { price: Number(r.price), observedAt: r.observed_at });
    }
  }
  return map;
});

/** Observations, optionally limited to some players and/or a start date; oldest first. */
export async function getObservations(opts: { playerIds?: string[]; since?: Date } = {}): Promise<Observation[]> {
  const { supabase } = await requireAuth();
  if (opts.playerIds && opts.playerIds.length === 0) return [];
  const rows = await fetchAll("price observations", (from, to) => {
    let q = supabase.from("price_observations").select("*");
    if (opts.playerIds) q = q.in("player_id", opts.playerIds);
    if (opts.since) q = q.gte("observed_at", opts.since.toISOString());
    return q.order("observed_at", { ascending: true }).order("id").range(from, to);
  });
  return rows.map(toObservation);
}

export const getAllObservations = cache(async (): Promise<Observation[]> => getObservations());

export interface PortfolioData {
  settings: Settings;
  players: Map<string, Player>;
  trades: Trade[];
  sales: Sale[];
  adjustments: Adjustment[];
  latestPrices: Map<string, LatestPrice>;
  lots: LotSummary[];
  holdings: Holding[];
  summary: PortfolioSummary;
}

/** Everything needed for portfolio-level numbers, computed once per request by the finance module. */
export const getPortfolio = cache(async (): Promise<PortfolioData> => {
  const [settings, players, trades, sales, adjustments, latestPrices] = await Promise.all([
    getSettings(),
    getPlayerMap(),
    getTrades(),
    getSales(),
    getAdjustments(),
    getLatestPrices(),
  ]);
  const lots = summarizeLots(trades, sales);
  const holdings = buildHoldings(lots, latestPrices, settings.taxRate);
  const summary = computePortfolioSummary({
    startingBalance: settings.startingCoinBalance,
    adjustments,
    lots,
    holdings,
  });
  return { settings, players, trades, sales, adjustments, latestPrices, lots, holdings, summary };
});

export const getWatchlist = cache(async (): Promise<WatchlistItem[]> => {
  const { supabase } = await requireAuth();
  const rows = await fetchAll("watchlist", (from, to) =>
    supabase.from("watchlist_items").select("*").order("created_at", { ascending: false }).order("id").range(from, to),
  );
  return rows.map(toWatchlistItem);
});

export const getAlerts = cache(async (): Promise<Alert[]> => {
  const { supabase } = await requireAuth();
  const rows = await fetchAll("alerts", (from, to) =>
    supabase.from("alerts").select("*").order("created_at", { ascending: false }).order("id").range(from, to),
  );
  return rows.map(toAlert);
});

export async function getAlertEvents(limit = 50): Promise<AlertEvent[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("alert_events")
    .select("*")
    .order("triggered_at", { ascending: false })
    .limit(Math.min(limit, 500));
  if (error) throw new DataLoadError("alert events", error.code);
  return (data ?? []).map(toAlertEvent);
}

export const getUnreadAlertCount = cache(async (): Promise<number> => {
  const { supabase } = await requireAuth();
  const { count, error } = await supabase
    .from("alert_events")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return 0; // a badge count is not worth failing the page for
  return count ?? 0;
});
