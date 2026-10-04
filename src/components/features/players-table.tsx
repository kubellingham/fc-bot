"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, Search, Trash2, UserPlus, Users } from "lucide-react";
import { Coins } from "@/components/app/money";
import { EmptyState } from "@/components/app/empty-state";
import { PriceAge } from "@/components/app/price-age";
import { ConfirmAction } from "@/components/features/confirm-action";
import { PlayerDialog } from "@/components/features/player-dialog";
import { ALL, FilterSelect, distinctOptions } from "@/components/tables/filter-select";
import { SortableHead, useSorted } from "@/components/tables/sorting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deletePlayer } from "@/lib/actions/players";
import { playerLabel, type Player } from "@/lib/domain";

export interface PlayerRow extends Player {
  latestPrice: number | null;
  latestObservedAt: string | null;
  held: number;
  watched: boolean;
}

type SortKey = "name" | "rating" | "latestPrice" | "held";

export function PlayersTable({ rows }: { rows: PlayerRow[] }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState(ALL);
  const [league, setLeague] = useState(ALL);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!q || [r.name, r.version, r.club ?? "", r.nation ?? "", r.rarity ?? ""].some((s) => s.toLowerCase().includes(q))) &&
        (position === ALL || r.position === position) &&
        (league === ALL || r.league === league),
    );
  }, [rows, query, position, league]);

  const { sorted, sort, toggle } = useSorted<PlayerRow, SortKey>(
    filtered,
    { name: (r) => playerLabel(r), rating: (r) => r.rating, latestPrice: (r) => r.latestPrice, held: (r) => r.held },
    { key: "name", dir: "asc" },
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="Your player catalog is empty"
        description="Add the cards you trade or want to track. You can also import a CSV from Import & export."
        action={<PlayerDialog trigger={<Button size="sm"><UserPlus />Add player</Button>} />}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, club, rarity…" aria-label="Search players" className="h-8 pl-8" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect label="Position" value={position} onChange={setPosition} allLabel="All positions" options={distinctOptions(rows.map((r) => r.position))} />
          <FilterSelect label="League" value={league} onChange={setLeague} allLabel="All leagues" options={distinctOptions(rows.map((r) => r.league))} />
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
          {sorted.length} of {rows.length} players
        </p>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Player" sortKey="name" sort={sort} onSort={toggle} />
              <SortableHead label="Rating" sortKey="rating" sort={sort} onSort={toggle} className="hidden sm:table-cell" />
              <TableHead className="hidden md:table-cell">Club · League</TableHead>
              <TableHead className="hidden lg:table-cell">Rarity</TableHead>
              <SortableHead label="Latest price" sortKey="latestPrice" sort={sort} onSort={toggle} className="text-right" />
              <SortableHead label="Held" sortKey="held" sort={sort} onSort={toggle} className="hidden text-right sm:table-cell" />
              <TableHead className="w-20">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/players/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {p.version}
                    {p.position && <span>· {p.position}</span>}
                    {p.watched && <Badge variant="info" className="px-1 py-0 text-[10px]">Watching</Badge>}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{p.rating ?? "—"}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {[p.club, p.league].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{p.rarity ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Coins value={p.latestPrice} />
                  <div>
                    <PriceAge observedAt={p.latestObservedAt} />
                  </div>
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">{p.held || "—"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <PlayerDialog
                      player={p}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${playerLabel(p)}`}>
                          <Pencil />
                        </Button>
                      }
                    />
                    <ConfirmAction
                      title={`Delete ${playerLabel(p)}?`}
                      description="This also deletes the player's recorded prices, watchlist entry and alerts. Players with recorded trades can't be deleted."
                      onConfirm={() => deletePlayer({ id: p.id })}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${playerLabel(p)}`}>
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
        {sorted.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No players match these filters.</p>}
      </div>
    </div>
  );
}
