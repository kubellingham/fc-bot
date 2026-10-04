"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Archive, ArchiveRestore, Bell, Eye, Pencil, Search, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Coins, PercentDelta } from "@/components/app/money";
import { EmptyState } from "@/components/app/empty-state";
import { PriceAge } from "@/components/app/price-age";
import { Sparkline } from "@/components/charts/sparkline";
import { AlertFormDialog } from "@/components/features/alert-dialog";
import { ConfirmAction } from "@/components/features/confirm-action";
import { ObservationDialog } from "@/components/features/observation-dialog";
import { WatchlistDialog } from "@/components/features/watchlist-dialog";
import type { PickerPlayer } from "@/components/forms/player-picker";
import { ALL, FilterSelect, distinctOptions } from "@/components/tables/filter-select";
import { SortableHead, useSorted } from "@/components/tables/sorting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeWatchlistItem, setWatchlistArchived } from "@/lib/actions/watchlist";
import type { WatchlistItem } from "@/lib/domain";
import { parseCoinInput } from "@/lib/validation/coins";

export interface WatchRow {
  item: WatchlistItem;
  label: string;
  position: string | null;
  league: string | null;
  club: string | null;
  latestPrice: number | null;
  latestObservedAt: string | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  spark: number[];
  atBuyTarget: boolean;
  atSellTarget: boolean;
}

type SortKey = "player" | "latestPrice" | "change24h" | "change7d" | "change30d";

function ArchiveButton({ row }: { row: WatchRow }) {
  const [pending, start] = useTransition();
  const archived = Boolean(row.item.archivedAt);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={archived ? `Restore ${row.label}` : `Archive ${row.label}`}
      title={archived ? "Restore" : "Archive"}
      onClick={() =>
        start(async () => {
          const r = await setWatchlistArchived({ id: row.item.id, archived: !archived });
          if (r && !r.ok) toast.error(r.error);
        })
      }
    >
      {archived ? <ArchiveRestore /> : <Archive />}
    </Button>
  );
}

export function WatchlistTable({ rows, players }: { rows: WatchRow[]; players: PickerPlayer[] }) {
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState(ALL);
  const [position, setPosition] = useState(ALL);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice ? parseCoinInput(minPrice) : null;
    const max = maxPrice ? parseCoinInput(maxPrice) : null;
    return rows.filter(
      (r) =>
        (showArchived ? Boolean(r.item.archivedAt) : !r.item.archivedAt) &&
        (!q || r.label.toLowerCase().includes(q)) &&
        (league === ALL || r.league === league) &&
        (position === ALL || r.position === position) &&
        (min === null || (r.latestPrice !== null && r.latestPrice >= min)) &&
        (max === null || (r.latestPrice !== null && r.latestPrice <= max)),
    );
  }, [rows, query, league, position, minPrice, maxPrice, showArchived]);

  const { sorted, sort, toggle } = useSorted<WatchRow, SortKey>(
    filtered,
    {
      player: (r) => r.label,
      latestPrice: (r) => r.latestPrice,
      change24h: (r) => r.change24h,
      change7d: (r) => r.change7d,
      change30d: (r) => r.change30d,
    },
    { key: "player", dir: "asc" },
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Eye />}
        title="Nothing on your watchlist"
        description="Watch players you're considering, set buy and sell targets, and track the prices you record."
        action={
          players.length > 0 ? (
            <WatchlistDialog players={players} trigger={<Button size="sm"><Eye />Watch a player</Button>} />
          ) : (
            <Button asChild size="sm">
              <Link href="/players">Add a player first</Link>
            </Button>
          )
        }
      />
    );
  }

  const archivedCount = rows.filter((r) => r.item.archivedAt).length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative lg:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player" aria-label="Search watchlist" className="h-8 pl-8" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect label="League" value={league} onChange={setLeague} allLabel="All leagues" options={distinctOptions(rows.map((r) => r.league))} />
          <FilterSelect label="Position" value={position} onChange={setPosition} allLabel="All positions" options={distinctOptions(rows.map((r) => r.position))} />
          <Input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min price" aria-label="Minimum latest price" className="h-8 sm:w-28" inputMode="decimal" />
          <Input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max price" aria-label="Maximum latest price" className="h-8 sm:w-28" inputMode="decimal" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground lg:ml-auto">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Show archived" />
          Archived ({archivedCount})
        </label>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Player" sortKey="player" sort={sort} onSort={toggle} />
              <SortableHead label="Latest" sortKey="latestPrice" sort={sort} onSort={toggle} className="text-right" />
              <SortableHead label="24h" sortKey="change24h" sort={sort} onSort={toggle} className="hidden text-right sm:table-cell" />
              <SortableHead label="7d" sortKey="change7d" sort={sort} onSort={toggle} className="hidden text-right sm:table-cell" />
              <SortableHead label="30d" sortKey="change30d" sort={sort} onSort={toggle} className="hidden text-right md:table-cell" />
              <TableHead className="hidden md:table-cell">Trend</TableHead>
              <TableHead className="text-right">Targets</TableHead>
              <TableHead className="w-36">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.item.id}>
                <TableCell>
                  <Link href={`/players/${r.item.playerId}`} className="font-medium hover:underline">
                    {r.label}
                  </Link>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {r.atBuyTarget && <Badge variant="gain">At buy target</Badge>}
                    {r.atSellTarget && <Badge variant="warning">At sell target</Badge>}
                    {!r.atBuyTarget && !r.atSellTarget && (
                      <span className="text-xs text-muted-foreground">{[r.position, r.league].filter(Boolean).join(" · ")}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Coins value={r.latestPrice} />
                  <div>
                    <PriceAge observedAt={r.latestObservedAt} />
                  </div>
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  <PercentDelta value={r.change24h} />
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  <PercentDelta value={r.change7d} />
                </TableCell>
                <TableCell className="hidden text-right md:table-cell">
                  <PercentDelta value={r.change30d} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Sparkline values={r.spark} />
                </TableCell>
                <TableCell className="text-right text-xs">
                  <div>
                    Buy ≤ <Coins value={r.item.targetBuyPrice} />
                  </div>
                  <div className="text-muted-foreground">
                    Sell ≥ <Coins value={r.item.targetSellPrice} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-0.5">
                    <ObservationDialog
                      players={players}
                      defaultPlayerId={r.item.playerId}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Record price for ${r.label}`} title="Record price">
                          <Tag />
                        </Button>
                      }
                    />
                    <WatchlistDialog
                      players={players}
                      item={r.item}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit targets for ${r.label}`} title="Edit targets">
                          <Pencil />
                        </Button>
                      }
                    />
                    <AlertFormDialog
                      players={players}
                      defaultPlayerId={r.item.playerId}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Create alert for ${r.label}`} title="Create alert">
                          <Bell />
                        </Button>
                      }
                    />
                    <ArchiveButton row={r} />
                    <ConfirmAction
                      title={`Remove ${r.label} from your watchlist?`}
                      description="Recorded prices and alerts are kept. Archive instead if you may watch it again."
                      confirmLabel="Remove"
                      onConfirm={() => removeWatchlistItem({ id: r.item.id })}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.label} from watchlist`} title="Remove">
                          <Trash2 />
                        </Button>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {sorted.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {showArchived ? "No archived players." : "No watched players match these filters."}
          </p>
        )}
      </div>
    </div>
  );
}
