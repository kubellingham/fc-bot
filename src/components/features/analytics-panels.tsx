"use client";

import Link from "next/link";
import { ChartFrame } from "@/components/charts/chart-frame";
import { PnlBarChart, type PnlPoint } from "@/components/charts/pnl-bar-chart";
import { SeriesChart } from "@/components/charts/series-chart";
import { Coins, DateOnly, Delta, PercentDelta } from "@/components/app/money";
import { useFormatter } from "@/components/format-provider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function PnlPanel({
  title,
  description,
  data,
  granularity,
}: {
  title: string;
  description?: string;
  data: PnlPoint[];
  granularity: "day" | "week" | "month";
}) {
  const f = useFormatter();
  const label = (k: string) => (granularity === "week" ? `Week of ${f.periodLabel(k, "day")}` : f.periodLabel(k, granularity));
  return (
    <ChartFrame
      title={title}
      description={description}
      chart={<PnlBarChart data={data} granularity={granularity} />}
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Sales</TableHead>
              <TableHead className="text-right">Realized P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data].reverse().map((d) => (
              <TableRow key={d.key}>
                <TableCell>{label(d.key)}</TableCell>
                <TableCell className="text-right">{d.trades}</TableCell>
                <TableCell className="text-right">
                  <Delta value={d.profit} showIcon={false} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}

export interface CumulativeRow {
  key: string;
  profit: number;
  cumulativeProfit: number;
  cumulativeRoiPercent: number | null;
}

export function CumulativePanel({ data }: { data: CumulativeRow[] }) {
  const f = useFormatter();
  return (
    <ChartFrame
      title="Cumulative realized P&L"
      description="Running total of profit from completed sales, including profit realized before this period."
      chart={<SeriesChart data={data.map((d) => ({ key: d.key, value: d.cumulativeProfit }))} label="Cumulative P&L" showZero />}
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead className="text-right">Day P&L</TableHead>
              <TableHead className="text-right">Cumulative</TableHead>
              <TableHead className="text-right">Cumulative ROI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data].reverse().map((d) => (
              <TableRow key={d.key}>
                <TableCell>{f.periodLabel(d.key, "day")}</TableCell>
                <TableCell className="text-right">
                  <Delta value={d.profit} showIcon={false} />
                </TableCell>
                <TableCell className="text-right">
                  <Delta value={d.cumulativeProfit} showIcon={false} />
                </TableCell>
                <TableCell className="text-right">
                  <PercentDelta value={d.cumulativeRoiPercent} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}

export function UtilizationPanel({ data }: { data: { key: string; value: number | null; invested: number; available: number }[] }) {
  const f = useFormatter();
  const points = data.filter((d) => d.value !== null).map((d) => ({ key: d.key, value: d.value as number }));
  return (
    <ChartFrame
      title="Capital utilization"
      description="Share of your coins tied up in cards at the end of each day: invested ÷ (available + invested)."
      chart={
        points.length > 1 ? (
          <SeriesChart data={points} label="Capital utilization" valueFormat="percent" height={200} />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Not enough history yet.</p>
        )
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead className="text-right">Invested</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Utilization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data].reverse().map((d) => (
              <TableRow key={d.key}>
                <TableCell>{f.periodLabel(d.key, "day")}</TableCell>
                <TableCell className="text-right">
                  <Coins value={d.invested} />
                </TableCell>
                <TableCell className="text-right">
                  <Coins value={d.available} />
                </TableCell>
                <TableCell className="text-right">{f.percent(d.value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}

export interface PlayerPerfRow {
  playerId: string;
  label: string;
  trades: number;
  unitsSold: number;
  profit: number;
  roiPercent: number | null;
}

export function PlayerPerformanceTable({ rows, empty }: { rows: PlayerPerfRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Sold</TableHead>
          <TableHead className="text-right">P&L</TableHead>
          <TableHead className="text-right">ROI</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.playerId}>
            <TableCell className="max-w-44 truncate">
              <Link href={`/players/${r.playerId}`} className="hover:underline">
                {r.label}
              </Link>
            </TableCell>
            <TableCell className="text-right">{r.unitsSold}</TableCell>
            <TableCell className="text-right">
              <Delta value={r.profit} showIcon={false} />
            </TableCell>
            <TableCell className="text-right">
              <PercentDelta value={r.roiPercent} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export interface HistoryRow {
  saleId: string;
  playerId: string;
  label: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  tax: number;
  profit: number;
  roiPercent: number | null;
  holdingHours: number;
  soldAt: string;
}

export function TradeHistoryTable({ rows }: { rows: HistoryRow[] }) {
  const f = useFormatter();
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No sales in this period.</p>;
  return (
    <div className="max-h-[28rem] overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sold</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Buy</TableHead>
            <TableHead className="text-right">Sell</TableHead>
            <TableHead className="hidden text-right md:table-cell">Tax</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="hidden text-right sm:table-cell">ROI</TableHead>
            <TableHead className="hidden text-right md:table-cell">Held</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.saleId}>
              <TableCell className="text-muted-foreground">
                <DateOnly iso={r.soldAt} />
              </TableCell>
              <TableCell className="max-w-44 truncate">
                <Link href={`/players/${r.playerId}`} className="hover:underline">
                  {r.label}
                </Link>
              </TableCell>
              <TableCell className="text-right">{r.quantity}</TableCell>
              <TableCell className="text-right">
                <Coins value={r.unitCost} />
              </TableCell>
              <TableCell className="text-right">
                <Coins value={r.unitPrice} />
              </TableCell>
              <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                <Coins value={r.tax} />
              </TableCell>
              <TableCell className="text-right">
                <Delta value={r.profit} showIcon={false} />
              </TableCell>
              <TableCell className="hidden text-right sm:table-cell">
                <PercentDelta value={r.roiPercent} />
              </TableCell>
              <TableCell className="hidden text-right text-muted-foreground md:table-cell">{f.duration(r.holdingHours)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
