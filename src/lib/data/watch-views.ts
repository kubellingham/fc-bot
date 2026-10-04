import "server-only";
import { playerLabel, type Observation, type Player, type WatchlistItem } from "@/lib/domain";
import { priceChangeOverWindow, sortObservations } from "@/lib/finance";
import type { WatchRow } from "@/components/features/watchlist-table";

/** Watchlist rows with period changes measured from each player's latest observation. */
export function watchRows(items: WatchlistItem[], players: Map<string, Player>, observations: Observation[]): WatchRow[] {
  const byPlayer = new Map<string, Observation[]>();
  for (const o of observations) {
    const list = byPlayer.get(o.playerId) ?? [];
    list.push(o);
    byPlayer.set(o.playerId, list);
  }
  return items.map((item) => {
    const player = players.get(item.playerId);
    const obs = sortObservations(byPlayer.get(item.playerId) ?? []);
    const latest = obs.at(-1) ?? null;
    const latestPrice = latest?.price ?? null;
    return {
      item,
      label: player ? playerLabel(player) : "Unknown player",
      position: player?.position ?? null,
      league: player?.league ?? null,
      club: player?.club ?? null,
      latestPrice,
      latestObservedAt: latest?.observedAt ?? null,
      change24h: priceChangeOverWindow(obs, 24)?.percentChange ?? null,
      change7d: priceChangeOverWindow(obs, 24 * 7)?.percentChange ?? null,
      change30d: priceChangeOverWindow(obs, 24 * 30)?.percentChange ?? null,
      spark: obs.slice(-30).map((o) => o.price),
      atBuyTarget: latestPrice !== null && item.targetBuyPrice !== null && latestPrice <= item.targetBuyPrice,
      atSellTarget: latestPrice !== null && item.targetSellPrice !== null && latestPrice >= item.targetSellPrice,
    };
  });
}
