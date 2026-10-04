"use client";

import { Bar, BarChart, type BarShapeProps, CartesianGrid, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFormatter } from "@/components/format-provider";
import { coinSign } from "@/lib/format";
import { AXIS_TICK, ChartTooltipBox } from "./chart-tooltip";

export interface PnlPoint {
  key: string;
  profit: number;
  trades: number;
}

/**
 * Realized P&L per period. Polarity is encoded by position (above / below the
 * zero baseline) first and colour second (validated CVD-safe gain/loss pair).
 */
export function PnlBarChart({
  data,
  granularity,
  height = 240,
}: {
  data: PnlPoint[];
  granularity: "day" | "week" | "month";
  height?: number;
}) {
  const f = useFormatter();
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Realized profit and loss by period. Use the table view for exact values.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={data.length > 40 ? 1 : "20%"}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="key"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(k: string) => f.periodLabel(k, granularity)}
            minTickGap={20}
          />
          <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={56} tickFormatter={(v: number) => f.coins(v, { compact: true })} />
          <ReferenceLine y={0} stroke="var(--chart-axis)" />
          <Tooltip
            cursor={{ fill: "var(--chart-cursor)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as PnlPoint;
              const label = granularity === "week" ? `Week of ${f.periodLabel(p.key, "day")}` : f.periodLabel(p.key, granularity);
              return (
                <ChartTooltipBox
                  title={label}
                  rows={[
                    {
                      label: "Realized P&L",
                      value: f.signedCoins(p.profit),
                      color: coinSign(p.profit) < 0 ? "var(--chart-loss)" : "var(--chart-gain)",
                    },
                    { label: "Sales", value: f.number(p.trades) },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="profit"
            isAnimationActive={false}
            maxBarSize={28}
            shape={(props: BarShapeProps) => {
              const p = props.payload as PnlPoint;
              const negative = coinSign(p.profit) < 0;
              return (
                <Rectangle
                  x={props.x}
                  y={props.y}
                  width={props.width}
                  height={props.height}
                  fill={negative ? "var(--chart-loss)" : "var(--chart-gain)"}
                  radius={negative ? [0, 0, 4, 4] : [4, 4, 0, 0]}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
