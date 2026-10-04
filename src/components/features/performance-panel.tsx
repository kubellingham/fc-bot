"use client";

import { useState } from "react";
import { ChartFrame } from "@/components/charts/chart-frame";
import { SeriesChart } from "@/components/charts/series-chart";
import { Coins, Delta } from "@/components/app/money";
import { useFormatter } from "@/components/format-provider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface PerformancePoint {
  key: string;
  portfolioValue: number;
  availableCoins: number;
  holdingsValue: number;
  cumulativeProfit: number;
}

/**
 * Portfolio value and cumulative realized P&L are different measures, so they
 * get separate single-axis views rather than a dual-axis chart.
 */
export function PerformancePanel({ points }: { points: PerformancePoint[] }) {
  const f = useFormatter();
  const [metric, setMetric] = useState<"value" | "realized">("value");
  const [days, setDays] = useState<30 | 90>(30);
  const visible = points.slice(-days);
  const isValue = metric === "value";
  const first = visible[0];
  const last = visible.at(-1);
  const change = first && last ? (isValue ? last.portfolioValue - first.portfolioValue : last.cumulativeProfit - first.cumulativeProfit) : null;

  const toggle = (value: string, current: string, label: string, onClick: () => void) => (
    <button
      key={value}
      type="button"
      aria-pressed={value === current}
      onClick={onClick}
      className={cn(
        "rounded-sm px-2 py-1 text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        value === current && "bg-accent text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <ChartFrame
      title={isValue ? "Portfolio value" : "Cumulative realized P&L"}
      description={
        <>
          {isValue ? "Available coins + holdings after tax, end of each day." : "Profit from completed sales over time."}{" "}
          {change !== null && (
            <span>
              {days}-day change <Delta value={change} showIcon={false} />
            </span>
          )}
        </>
      }
      actions={
        <div className="hidden gap-1 sm:flex">
          <div role="group" aria-label="Metric" className="flex rounded-md border p-0.5">
            {toggle("value", metric, "Value", () => setMetric("value"))}
            {toggle("realized", metric, "Realized", () => setMetric("realized"))}
          </div>
          <div role="group" aria-label="Range" className="flex rounded-md border p-0.5">
            {toggle("30", String(days), "30D", () => setDays(30))}
            {toggle("90", String(days), "90D", () => setDays(90))}
          </div>
        </div>
      }
      chart={
        <SeriesChart
          data={visible.map((p) => ({ key: p.key, value: isValue ? p.portfolioValue : p.cumulativeProfit }))}
          label={isValue ? "Portfolio value" : "Cumulative P&L"}
          showZero={!isValue}
        />
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Holdings</TableHead>
              <TableHead className="text-right">Portfolio</TableHead>
              <TableHead className="text-right">Cumulative P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...visible].reverse().map((p) => (
              <TableRow key={p.key}>
                <TableCell>{f.periodLabel(p.key, "day")}</TableCell>
                <TableCell className="text-right">
                  <Coins value={p.availableCoins} />
                </TableCell>
                <TableCell className="text-right">
                  <Coins value={p.holdingsValue} />
                </TableCell>
                <TableCell className="text-right">
                  <Coins value={p.portfolioValue} />
                </TableCell>
                <TableCell className="text-right">
                  <Delta value={p.cumulativeProfit} showIcon={false} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}
