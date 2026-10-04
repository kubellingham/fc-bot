"use client";

import Link from "next/link";
import { RefreshCw, Plus, Trash2 } from "lucide-react";
import { Coins, DateTime, Delta } from "@/components/app/money";
import { AdjustmentDialog, ReconcileDialog } from "@/components/features/coin-dialogs";
import { ConfirmAction } from "@/components/features/confirm-action";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteAdjustment } from "@/lib/actions/coins";
import type { Adjustment } from "@/lib/domain";

export function CoinLedger({
  startingBalance,
  adjustments,
  availableCoins,
}: {
  startingBalance: number;
  adjustments: Adjustment[];
  availableCoins: number;
}) {
  const shown = adjustments.slice(0, 8);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Coin ledger</CardTitle>
        <CardDescription className="text-xs">
          Starting balance <Coins value={startingBalance} /> ·{" "}
          <Link href="/settings" className="underline underline-offset-2">
            change
          </Link>
        </CardDescription>
        <CardAction className="flex gap-2">
          <ReconcileDialog
            trackedBalance={availableCoins}
            trigger={
              <Button size="sm" variant="outline">
                <RefreshCw />
                <span className="hidden sm:inline">Sync with game</span>
              </Button>
            }
          />
          <AdjustmentDialog
            trigger={
              <Button size="sm" variant="outline">
                <Plus />
                <span className="hidden sm:inline">Adjustment</span>
              </Button>
            }
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No adjustments. Add coins earned from objectives or spent on packs, or sync with your in-game balance.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {shown.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{a.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    <DateTime iso={a.occurredAt} />
                  </p>
                </div>
                <Delta value={a.amount} showIcon={false} />
                <ConfirmAction
                  title="Delete adjustment?"
                  description="Your available coin balance will be recalculated without it."
                  onConfirm={() => deleteAdjustment({ id: a.id })}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete adjustment: ${a.reason}`}>
                      <Trash2 />
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {adjustments.length > shown.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the latest {shown.length} of {adjustments.length}. Export all from Import & export.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
