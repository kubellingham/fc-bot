import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PlayerDialog } from "@/components/features/player-dialog";
import { PlayersTable } from "@/components/features/players-table";
import { Button } from "@/components/ui/button";
import { getPlayers, getPortfolio, getWatchlist } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Players & prices" };

export default async function PlayersPage() {
  const [players, portfolio, watchlist] = await Promise.all([getPlayers(), getPortfolio(), getWatchlist()]);
  const held = new Map(portfolio.holdings.map((h) => [h.playerId, h.quantity]));
  const watched = new Set(watchlist.filter((w) => !w.archivedAt).map((w) => w.playerId));
  const rows = players.map((p) => {
    const latest = portfolio.latestPrices.get(p.id);
    return {
      ...p,
      latestPrice: latest?.price ?? null,
      latestObservedAt: latest?.observedAt ?? null,
      held: held.get(p.id) ?? 0,
      watched: watched.has(p.id),
    };
  });
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Players & prices"
        description="Your private card catalog. Open a player to see its recorded price history."
        actions={<PlayerDialog trigger={<Button size="sm"><UserPlus />Add player</Button>} />}
      />
      <PlayersTable rows={rows} />
    </div>
  );
}
