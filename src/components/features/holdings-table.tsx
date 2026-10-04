"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search, Tag, Wallet } from "lucide-react";
import { Coins, Delta, PercentDelta } from "@/components/app/money";
import { EmptyState } from "@/components/app/empty-state";
import { PriceAge } from "@/components/app/price-age";
import { ObservationDialog } from "@/components/features/observation-dialog";
import { SaleDialog } from "@/components/features/sale-dialog";
import { TradeDialog } from "@/components/features/trade-dialog";
import type { PickerPlayer } from "@/components/forms/player-picker";
import { ALL, FilterSelect, distinctOptions } from "@/components/tables/filter-select";
import { SortableHead, useSorted } from "@/components/tables/sorting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { HoldingRow } from "@/lib/data/views";
import { coinSign } from "@/lib/format";

type SortKey = "player" | "quantity" | "averageCost" | "marketValue" | "unrealizedProfit" | "unrealizedRoiPercent";
const STATUS = [
  { value: "profit", label: "In profit" },
  { value: "loss", label: "At a loss" },
  { value: "unpriced", label: "No price recorded" },
];

function statusOf(h: HoldingRow): "profit" | "loss" | "flat" | "unpriced" {
  if (h.unrealizedProfit === null) return "unpriced";
  const s = coinSign(h.unrealizedProfit);
  return s > 0 ? "profit" : s < 0 ? "loss" : "flat";
}

export function HoldingsTable({ rows, players, taxRate }: { rows: HoldingRow[]; players: PickerPlayer[]; taxRate: number }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState(ALL);
  const [club, setClub] = useState(ALL);
  const [league, setLeague] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!q || r.label.toLowerCase().includes(q)) &&
        (position === ALL || r.position === position) &&
        (club === ALL || r.club === club) &&
        (league === ALL || r.league === league) &&
        (status === ALL || statusOf(r) === status),
    );
  }, [rows, query, position, club, league, status]);

  const { sorted, sort, toggle } = useSorted<HoldingRow, SortKey>(
    filtered,
    {
      player: (r) => r.label,
      quantity: (r) => r.quantity,
      averageCost: (r) => r.averageCost,
      marketValue: (r) => r.marketValue,
      unrealizedProfit: (r) => r.unrealizedProfit,
      unrealizedRoiPercent: (r) => r.unrealizedRoiPercent,
    },
    { key: "marketValue", dir: "desc" },
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Wallet />}
        title="No holdings yet"
        description="Record a purchase to start tracking cost, value and profit after tax."
        action={
          players.length > 0 ? (
            <TradeDialog players={players} taxRate={taxRate} trigger={<Button size="sm"><Plus />Record purchase</Button>} />
          ) : (
            <Button asChild size="sm">
              <Link href="/players">Add your first player</Link>
            </Button>
          )
        }
      />
    );
  }

  const filtersActive = query || [position, club, league, status].some((v) => v !== ALL);

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player" aria-label="Search player" className="h-8 pl-8" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect label="Position" value={position} onChange={setPosition} allLabel="All positions" options={distinctOptions(rows.map((r) => r.position))} />
          <FilterSelect label="Club" value={club} onChange={setClub} allLabel="All clubs" options={distinctOptions(rows.map((r) => r.club))} />
          <FilterSelect label="League" value={league} onChange={setLeague} allLabel="All leagues" options={distinctOptions(rows.map((r) => r.league))} />
          <FilterSelect label="Status" value={status} onChange={setStatus} allLabel="Any status" options={STATUS} />
        </div>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setPosition(ALL);
              setClub(ALL);
              setLeague(ALL);
              setStatus(ALL);
            }}
          >
            Clear filters
          </Button>
        )}
        <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
          {sorted.length} of {rows.length} holdings
        </p>
      </div>

      {/* Phones: compact cards for quick checks */}
      <ul className="grid gap-2 md:hidden">
        {sorted.map((r) => (
          <li key={r.playerId} className="rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/players/${r.playerId}`} className="block truncate font-medium hover:underline">
                  {r.label}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {r.quantity} × <Coins value={r.averageCost} /> avg
                </p>
              </div>
              <Delta value={r.unrealizedProfit} percent={r.unrealizedRoiPercent} className="text-sm" />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Latest <Coins value={r.latestPrice} className="text-foreground" /> · <PriceAge observedAt={r.latestObservedAt} />
              </span>
              <RowActions row={r} players={players} taxRate={taxRate} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Player" sortKey="player" sort={sort} onSort={toggle} />
              <SortableHead label="Qty" sortKey="quantity" sort={sort} onSort={toggle} className="text-right" />
              <SortableHead label="Avg cost" sortKey="averageCost" sort={sort} onSort={toggle} className="text-right" />
              <TableHead className="text-right">Latest price</TableHead>
              <SortableHead label="Market value" sortKey="marketValue" sort={sort} onSort={toggle} className="text-right" />
              <SortableHead label="Unrealized P&L" sortKey="unrealizedProfit" sort={sort} onSort={toggle} className="text-right" />
              <SortableHead label="ROI" sortKey="unrealizedRoiPercent" sort={sort} onSort={toggle} className="text-right" />
              <TableHead className="text-right">Break-even</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.playerId}>
                <TableCell>
                  <Link href={`/players/${r.playerId}`} className="font-medium hover:underline">
                    {r.label}
                  </Link>
                  <div className="text-xs text-muted-foreground">{[r.position, r.club].filter(Boolean).join(" · ") || "—"}</div>
                </TableCell>
                <TableCell className="text-right">
                  {r.quantity}
                  {r.openLots.length > 1 && <div className="text-xs text-muted-foreground">{r.openLots.length} buys</div>}
                </TableCell>
                <TableCell className="text-right">
                  <Coins value={r.averageCost} />
                  <div className="text-xs text-muted-foreground">
                    <Coins value={r.totalCost} /> total
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {r.latestPrice === null ? (
                    <Badge variant="warning">No price</Badge>
                  ) : (
                    <>
                      <Coins value={r.latestPrice} />
                      <div>
                        <PriceAge observedAt={r.latestObservedAt} />
                      </div>
                    </>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Coins value={r.marketValue} />
                  {r.liquidationValue !== null && (
                    <div className="text-xs text-muted-foreground">
                      <Coins value={r.liquidationValue} /> after tax
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Delta value={r.unrealizedProfit} />
                </TableCell>
                <TableCell className="text-right">
                  <PercentDelta value={r.unrealizedRoiPercent} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  <Coins value={r.breakEvenPrice} />
                </TableCell>
                <TableCell>
                  <RowActions row={r} players={players} taxRate={taxRate} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {sorted.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No holdings match these filters.</p>}
      </div>
    </div>
  );
}

function RowActions({ row, players, taxRate }: { row: HoldingRow; players: PickerPlayer[]; taxRate: number }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <SaleDialog
        target={{ playerId: row.playerId }}
        lots={row.openLots}
        taxRate={taxRate}
        playerName={row.label}
        defaultPrice={row.latestPrice}
        trigger={
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
            Sell
          </Button>
        }
      />
      <ObservationDialog
        players={players}
        defaultPlayerId={row.playerId}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Record price for ${row.label}`} title="Record price">
            <Tag />
          </Button>
        }
      />
      <TradeDialog
        players={players}
        taxRate={taxRate}
        defaultPlayerId={row.playerId}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Buy more ${row.label}`} title="Record another purchase">
            <Plus />
          </Button>
        }
      />
    </div>
  );
}
