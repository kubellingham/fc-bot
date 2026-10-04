"use client";

import { useMemo, useState } from "react";
import { LineChart, Trash2 } from "lucide-react";
import { ChartFrame } from "@/components/charts/chart-frame";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { Coins, DateTime } from "@/components/app/money";
import { EmptyState } from "@/components/app/empty-state";
import { ConfirmAction } from "@/components/features/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteObservation } from "@/lib/actions/prices";
import type { Observation } from "@/lib/domain";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "7", label: "7D", days: 7 },
  { value: "30", label: "30D", days: 30 },
  { value: "90", label: "90D", days: 90 },
  { value: "all", label: "All", days: null },
] as const;

/** Price history chart with a range filter and its table-view twin (the observation log). */
export function PlayerPricePanel({
  observations,
  targetBuy,
  targetSell,
  averageCost,
  recordButton,
}: {
  observations: Observation[];
  targetBuy: number | null;
  targetSell: number | null;
  averageCost: number | null;
  recordButton: React.ReactNode;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("30");
  const visible = useMemo(() => {
    const days = RANGES.find((r) => r.value === range)?.days ?? null;
    if (days === null || observations.length === 0) return observations;
    // Range is anchored to the latest observation, not to "now", so old data still charts.
    const latest = Date.parse(observations[observations.length - 1].observedAt);
    return observations.filter((o) => Date.parse(o.observedAt) >= latest - days * 86_400_000);
  }, [observations, range]);

  if (observations.length === 0) {
    return (
      <EmptyState
        icon={<LineChart />}
        title="No prices recorded yet"
        description="Record the prices you see on the Transfer Market to build this player's history. Prices never update on their own."
        action={recordButton}
      />
    );
  }

  const points = visible.map((o) => ({ t: Date.parse(o.observedAt), price: o.price, id: o.id }));
  return (
    <ChartFrame
      title="Recorded price history"
      description={`${visible.length} of ${observations.length} observations · range measured from the latest observation`}
      actions={
        <div role="group" aria-label="Chart range" className="flex rounded-md border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={range === r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                "rounded-sm px-2 py-1 text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                range === r.value && "bg-accent text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
      chart={
        points.length < 2 ? (
          <p className="px-2 py-10 text-center text-sm text-muted-foreground">
            Only one observation in this range — record another to see a trend.
          </p>
        ) : (
          <PriceHistoryChart data={points} targetBuy={targetBuy} targetSell={targetSell} costBasis={averageCost} />
        )
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Observed</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="hidden sm:table-cell">Notes</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...visible].reverse().map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <DateTime iso={o.observedAt} />
                </TableCell>
                <TableCell className="text-right">
                  <Coins value={o.price} />
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{o.source === "import" ? "Imported" : "Manual"}</Badge>
                </TableCell>
                <TableCell className="hidden max-w-60 truncate text-muted-foreground sm:table-cell">{o.notes ?? ""}</TableCell>
                <TableCell>
                  <ConfirmAction
                    title="Delete this price?"
                    description="Charts, unrealized P&L and alerts will be recalculated without it."
                    onConfirm={() => deleteObservation({ id: o.id })}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Delete price observation">
                        <Trash2 />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}
