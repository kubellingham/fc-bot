"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFormatter } from "@/components/format-provider";
import { AXIS_TICK, ChartTooltipBox } from "./chart-tooltip";

export interface SeriesPoint {
  key: string;
  value: number;
}

/**
 * Single-series time chart (portfolio value, cumulative P&L). One hue, no
 * legend box — the card title names the series. 2px line, soft fill,
 * hairline solid grid, crosshair tooltip.
 */
export function SeriesChart({
  data,
  label,
  height = 240,
  showZero = false,
  granularity = "day",
  valueFormat = "coins",
}: {
  data: SeriesPoint[];
  label: string;
  height?: number;
  showZero?: boolean;
  granularity?: "day" | "week" | "month";
  valueFormat?: "coins" | "percent";
}) {
  const f = useFormatter();
  const fmtTick = (v: number) => (valueFormat === "percent" ? `${f.number(v, 0)}%` : f.coins(v, { compact: true }));
  const fmtValue = (v: number) => (valueFormat === "percent" ? f.percent(v) : f.coins(v));
  const gradientId = `fill-${label.replace(/\W/g, "")}`;
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`${label} chart. Use the table view for exact values.`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-value)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-value)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="key"
            tickLine={false}
            axisLine={{ stroke: "var(--chart-axis)" }}
            tick={AXIS_TICK}
            tickFormatter={(k: string) => f.periodLabel(k, granularity)}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={56}
            tickFormatter={fmtTick}
            domain={valueFormat === "percent" ? [0, "auto"] : ["auto", "auto"]}
          />
          {showZero && <ReferenceLine y={0} stroke="var(--chart-axis)" />}
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as SeriesPoint;
              return (
                <ChartTooltipBox
                  title={f.periodLabel(p.key, granularity)}
                  rows={[{ label, value: fmtValue(p.value), color: "var(--chart-value)" }]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={label}
            stroke="var(--chart-value)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-value)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
