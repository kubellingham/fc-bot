import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { WatchlistDialog } from "@/components/features/watchlist-dialog";
import { WatchlistTable } from "@/components/features/watchlist-table";
import { Button } from "@/components/ui/button";
import { getObservations, getPlayerMap, getPlayers, getWatchlist } from "@/lib/data/queries";
import { watchRows } from "@/lib/data/watch-views";

export const metadata: Metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const [items, players, playerMap] = await Promise.all([getWatchlist(), getPlayers(), getPlayerMap()]);
  const observations = await getObservations({ playerIds: items.map((i) => i.playerId) });
  const rows = watchRows(items, playerMap, observations);
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Watchlist"
        description="Prices here are the ones you record — they don't update automatically. Changes are measured back from each player's latest observation."
        actions={players.length > 0 ? <WatchlistDialog players={players} trigger={<Button size="sm"><Eye />Watch a player</Button>} /> : undefined}
      />
      <WatchlistTable rows={rows} players={players} />
    </div>
  );
}
