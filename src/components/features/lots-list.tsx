"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Coins, DateOnly, DateTime, Delta } from "@/components/app/money";
import { ConfirmAction } from "@/components/features/confirm-action";
import { SaleDialog } from "@/components/features/sale-dialog";
import { TradeDialog } from "@/components/features/trade-dialog";
import type { PickerPlayer } from "@/components/forms/player-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteSale, deleteTrade } from "@/lib/actions/trades";
import type { TradeRow } from "@/lib/data/views";

export const STATUS_BADGE = {
  open: { label: "Open", variant: "info" },
  partial: { label: "Partly sold", variant: "warning" },
  closed: { label: "Closed", variant: "secondary" },
} as const;

/** Purchases with their sales, with edit / sell / delete actions. Used on player pages. */
export function LotsList({ rows, players, taxRate }: { rows: TradeRow[]; players: PickerPlayer[]; taxRate: number }) {
  return (
    <ul className="grid gap-2">
      {rows.map((t) => (
        <li key={t.id} className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge variant={STATUS_BADGE[t.status].variant}>{STATUS_BADGE[t.status].label}</Badge>
            <span>
              Bought {t.quantity} × <Coins value={t.unitCost} /> on <DateOnly iso={t.acquiredAt} />
            </span>
            {t.soldQuantity > 0 && (
              <span className="text-muted-foreground">
                · realized <Delta value={t.realizedProfit} percent={t.realizedRoiPercent} />
              </span>
            )}
            <div className="ml-auto flex gap-1">
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
                  <Button variant="ghost" size="icon-sm" aria-label="Edit purchase">
                    <Pencil />
                  </Button>
                }
              />
              <ConfirmAction
                title="Delete this purchase?"
                description={
                  t.sales.length > 0
                    ? `Its ${t.sales.length} recorded sale${t.sales.length === 1 ? "" : "s"} will be deleted too. Your P&L and coin balance will be recalculated.`
                    : "Your holdings and coin balance will be recalculated."
                }
                onConfirm={() => deleteTrade({ id: t.id })}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="Delete purchase">
                    <Trash2 />
                  </Button>
                }
              />
            </div>
          </div>
          {t.notes && <p className="mt-1 text-xs text-muted-foreground">{t.notes}</p>}
          {t.sales.length > 0 && (
            <ul className="mt-2 grid gap-1 border-l pl-3 text-xs text-muted-foreground">
              {t.sales.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="flex-1">
                    Sold {s.quantity} × <Coins value={s.unitPrice} className="text-foreground" /> · <DateTime iso={s.soldAt} />
                    {s.taxRate !== taxRate && ` · ${(s.taxRate * 100).toFixed(2).replace(/\.?0+$/, "")}% tax`}
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
        </li>
      ))}
    </ul>
  );
}
