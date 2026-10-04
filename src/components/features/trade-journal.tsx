"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, NotebookPen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Coins, DateOnly, DateTime, Delta, PercentDelta } from "@/components/app/money";
import { EmptyState } from "@/components/app/empty-state";
import { ConfirmAction } from "@/components/features/confirm-action";
import { STATUS_BADGE } from "@/components/features/lots-list";
import { SaleDialog } from "@/components/features/sale-dialog";
import { TradeDialog } from "@/components/features/trade-dialog";
import type { PickerPlayer } from "@/components/forms/player-picker";
import { ALL, FilterSelect } from "@/components/tables/filter-select";
import { SortableHead, useSorted } from "@/components/tables/sorting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteSale, deleteTrade } from "@/lib/actions/trades";
import type { TradeRow } from "@/lib/data/views";

type SortKey = "player" | "acquiredAt" | "lastSoldAt" | "unitCost" | "realizedProfit" | "realizedRoiPercent";
const STATUSES = [
  { value: "open", label: "Open" },
  { value: "partial", label: "Partly sold" },
  { value: "closed", label: "Closed" },
];

export function TradeJournal({ rows, players, taxRate }: { rows: TradeRow[]; players: PickerPlayer[]; taxRate: number }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!q || r.label.toLowerCase().includes(q) || (r.notes ?? "").toLowerCase().includes(q)) && (status === ALL || r.status === status));
  }, [rows, query, status]);

  const { sorted, sort, toggle } = useSorted<TradeRow, SortKey>(
    filtered,
    {
      player: (r) => r.label,
      acquiredAt: (r) => Date.parse(r.acquiredAt),
      lastSoldAt: (r) => (r.lastSoldAt ? Date.parse(r.lastSoldAt) : null),
      unitCost: (r) => r.unitCost,
      realizedProfit: (r) => (r.soldQuantity > 0 ? r.realizedProfit : null),
      realizedRoiPercent: (r) => r.realizedRoiPercent,
    },
    { key: "acquiredAt", dir: "desc" },
  );

  const toggleRow = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<NotebookPen />}
        title="Your trade journal is empty"
        description="Every purchase you record appears here with its sales, tax, net proceeds and profit."
        action={
          players.length > 0 ? (
            <TradeDialog players={players} taxRate={taxRate} trigger={<Button size="sm"><Plus />Record purchase</Button>} />
          ) : (
            <Button asChild size="sm">
              <Link href="/players">Add a player first</Link>
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player or notes" aria-label="Search trades" className="h-8 pl-8" />
        </div>
        <FilterSelect label="Status" value={status} onChange={setStatus} allLabel="All statuses" options={STATUSES} />
        <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
          {sorted.length} of {rows.length} trades
        </p>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <span className="sr-only">Expand</span>
              </TableHead>
              <SortableHead label="Player" sortKey="player" sort={sort} onSort={toggle} />
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <SortableHead label="Buy" sortKey="unitCost" sort={sort} onSort={toggle} className="text-right" />
              <TableHead className="text-right">Avg sell</TableHead>
              <SortableHead label="Bought" sortKey="acquiredAt" sort={sort} onSort={toggle} className="hidden md:table-cell" />
              <SortableHead label="Sold" sortKey="lastSoldAt" sort={sort} onSort={toggle} className="hidden md:table-cell" />
              <TableHead className="hidden text-right lg:table-cell">Tax</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Net proceeds</TableHead>
              <SortableHead label="Net profit" sortKey="realizedProfit" sort={sort} onSort={toggle} className="text-right" />
              <SortableHead label="ROI" sortKey="realizedRoiPercent" sort={sort} onSort={toggle} className="hidden text-right sm:table-cell" />
              <TableHead className="w-24">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((t) => {
              const open = expanded.has(t.id);
              return (
                <Fragment key={t.id}>
                  <TableRow data-state={open ? "selected" : undefined}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-6"
                        onClick={() => toggleRow(t.id)}
                        aria-expanded={open}
                        aria-label={open ? "Hide details" : "Show sales and notes"}
                      >
                        {open ? <ChevronDown /> : <ChevronRight />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Link href={`/players/${t.playerId}`} className="font-medium hover:underline">
                        {t.label}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[t.status].variant}>{STATUS_BADGE[t.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {t.soldQuantity > 0 && t.status !== "closed" ? `${t.soldQuantity}/${t.quantity}` : t.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      <Coins value={t.unitCost} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Coins value={t.averageSalePrice} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      <DateOnly iso={t.acquiredAt} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      <DateOnly iso={t.lastSoldAt} />
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground lg:table-cell">
                      {t.soldQuantity > 0 ? <Coins value={t.tax} /> : "—"}
                    </TableCell>
                    <TableCell className="hidden text-right lg:table-cell">{t.soldQuantity > 0 ? <Coins value={t.netProceeds} /> : "—"}</TableCell>
                    <TableCell className="text-right">{t.soldQuantity > 0 ? <Delta value={t.realizedProfit} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <PercentDelta value={t.realizedRoiPercent} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {t.remainingQuantity > 0 && (
                          <SaleDialog
                            target={{ tradeId: t.id }}
                            lots={[{ id: t.id, remainingQuantity: t.remainingQuantity, unitCost: t.unitCost, acquiredAt: t.acquiredAt }]}
                            taxRate={taxRate}
                            playerName={t.label}
                            trigger={
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                                Sell
                              </Button>
                            }
                          />
                        )}
                        <TradeDialog
                          players={players}
                          taxRate={taxRate}
                          trade={{ id: t.id, playerId: t.playerId, quantity: t.quantity, unitCost: t.unitCost, acquiredAt: t.acquiredAt, notes: t.notes, createdAt: t.acquiredAt }}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Edit purchase of ${t.label}`}>
                              <Pencil />
                            </Button>
                          }
                        />
                        <ConfirmAction
                          title="Delete this trade?"
                          description={`The purchase${t.sales.length ? ` and its ${t.sales.length} sale${t.sales.length === 1 ? "" : "s"}` : ""} will be removed and your P&L recalculated.`}
                          onConfirm={() => deleteTrade({ id: t.id })}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Delete trade of ${t.label}`}>
                              <Trash2 />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {open && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell />
                      <TableCell colSpan={12} className="whitespace-normal">
                        <div className="grid gap-2 py-1 text-sm">
                          <p className="text-xs text-muted-foreground">
                            Bought <DateTime iso={t.acquiredAt} /> · cost <Coins value={t.unitCost * t.quantity} /> for {t.quantity}
                            {t.soldQuantity > 0 && (
                              <>
                                {" "}
                                · gross <Coins value={t.grossProceeds} /> · tax <Coins value={t.tax} /> · net <Coins value={t.netProceeds} /> vs cost{" "}
                                <Coins value={t.costOfSold} />
                              </>
                            )}
                          </p>
                          {t.notes && <p className="text-xs">Notes: {t.notes}</p>}
                          {t.sales.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No sales recorded.</p>
                          ) : (
                            <ul className="grid gap-1">
                              {t.sales.map((s) => (
                                <li key={s.id} className="flex items-center gap-2 text-xs">
                                  <span className="flex-1">
                                    Sold {s.quantity} × <Coins value={s.unitPrice} /> on <DateTime iso={s.soldAt} /> at{" "}
                                    {(s.taxRate * 100).toFixed(2).replace(/\.?0+$/, "")}% tax
                                    {s.notes && <span className="text-muted-foreground"> — {s.notes}</span>}
                                  </span>
                                  <ConfirmAction
                                    title="Delete this sale?"
                                    description="The copies return to your holdings and P&L is recalculated."
                                    onConfirm={() => deleteSale({ id: s.id })}
                                    trigger={
                                      <Button variant="ghost" size="icon-sm" className="size-6" aria-label="Delete sale">
                                        <Trash2 className="size-3" />
                                      </Button>
                                    }
                                  />
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        {sorted.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No trades match these filters.</p>}
      </div>
    </div>
  );
}
