"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Coins, DateTime, Delta, PercentDelta } from "@/components/app/money";
import { PriceAge } from "@/components/app/price-age";
import { Badge } from "@/components/ui/badge";
import type { WatchRow } from "@/components/features/watchlist-table";
import type { ActivityItem } from "@/lib/data/views";

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No transactions recorded yet.</p>;
  return (
    <ul className="divide-y">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-full ${a.kind === "buy" ? "bg-info/10 text-info" : "bg-primary/10 text-primary"}`}
            aria-hidden="true"
          >
            {a.kind === "buy" ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate">
              <span className="sr-only">{a.kind === "buy" ? "Bought" : "Sold"} </span>
              <Link href={`/players/${a.playerId}`} className="font-medium hover:underline">
                {a.label}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              {a.kind === "buy" ? "Bought" : "Sold"} {a.quantity} × <Coins value={a.unitPrice} /> · <DateTime iso={a.at} relative />
            </p>
          </div>
          {a.profit !== null && <Delta value={a.profit} className="text-sm" />}
        </li>
      ))}
    </ul>
  );
}

export function WatchlistSummary({ rows }: { rows: WatchRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Your watchlist is empty.</p>;
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.item.id} className="flex items-center gap-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <Link href={`/players/${r.item.playerId}`} className="block truncate font-medium hover:underline">
              {r.label}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5">
              {r.atBuyTarget && <Badge variant="gain">At buy target</Badge>}
              {r.atSellTarget && <Badge variant="warning">At sell target</Badge>}
              <PriceAge observedAt={r.latestObservedAt} />
            </div>
          </div>
          <div className="text-right">
            <Coins value={r.latestPrice} />
            <div className="text-xs">
              <PercentDelta value={r.change24h} /> <span className="text-muted-foreground">24h</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
