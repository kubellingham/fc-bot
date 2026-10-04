"use client";

/** Tooltip body styled with app tokens. Values use text ink; a colour swatch carries identity. */
export function ChartTooltipBox({
  title,
  rows,
}: {
  title: React.ReactNode;
  rows: { label: string; value: React.ReactNode; color?: string }[];
}) {
  return (
    <div className="min-w-40 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{title}</p>
      <dl className="grid gap-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden="true" />}
              {r.label}
            </dt>
            <dd className="font-medium tabular">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const AXIS_TICK = { fill: "var(--chart-ink)", fontSize: 11 };
