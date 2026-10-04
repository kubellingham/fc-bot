"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFormatter } from "@/components/format-provider";
import { AXIS_TICK, ChartTooltipBox } from "./chart-tooltip";

export interface PricePoint {
  t: number;
  price: number;
  id: string;
}

/**
 * Recorded prices on a true time axis (observations are irregular). Each
 * observation is a visible marker; buy/sell targets are labelled thresholds.
 */
export function PriceHistoryChart({
  data,
  targetBuy,
  targetSell,
  costBasis,
  height = 260,
}: {
  data: PricePoint[];
  targetBuy?: number | null;
  targetSell?: number | null;
  costBasis?: number | null;
  height?: number;
}) {
  const f = useFormatter();
  const values = [...data.map((d) => d.price), targetBuy, targetSell, costBasis].filter((v): v is number => typeof v === "number");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.1, max * 0.02, 1);

  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Recorded price history. Use the table view for exact values.">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-axis)" }}
            tick={AXIS_TICK}
            tickFormatter={(t: number) => f.date(new Date(t).toISOString())}
            minTickGap={32}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={56}
            domain={[Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]}
            tickFormatter={(v: number) => f.coins(v, { compact: true })}
          />
          {targetBuy && (
            <ReferenceLine
              y={targetBuy}
              stroke="var(--chart-gain)"
              strokeDasharray="4 4"
              label={{ value: `Buy ≤ ${f.coins(targetBuy, { compact: true })}`, position: "insideBottomLeft", fill: "var(--chart-ink)", fontSize: 11 }}
            />
          )}
          {targetSell && (
            <ReferenceLine
              y={targetSell}
              stroke="var(--chart-loss)"
              strokeDasharray="4 4"
              label={{ value: `Sell ≥ ${f.coins(targetSell, { compact: true })}`, position: "insideTopLeft", fill: "var(--chart-ink)", fontSize: 11 }}
            />
          )}
          {costBasis && (
            <ReferenceLine
              y={costBasis}
              stroke="var(--chart-ink)"
              label={{ value: `Avg cost ${f.coins(costBasis, { compact: true })}`, position: "insideTopRight", fill: "var(--chart-ink)", fontSize: 11 }}
            />
          )}
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as PricePoint;
              return (
                <ChartTooltipBox
                  title={f.dateTime(new Date(p.t).toISOString())}
                  rows={[{ label: "Recorded price", value: f.coins(p.price), color: "var(--chart-value)" }]}
                />
              );
            }}
          />
          <Line
            type="linear"
            dataKey="price"
            stroke="var(--chart-value)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-value)" }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-value)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
