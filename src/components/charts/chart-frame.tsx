"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Card wrapper giving every chart a table-view twin, so no value is reachable
 * only through hover (WCAG-equivalent alternative).
 */
export function ChartFrame({
  title,
  description,
  chart,
  table,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
        <CardAction className="flex items-center gap-2">
          {actions}
          <div role="group" aria-label={`${title} view`} className="flex rounded-md border p-0.5">
            {(
              [
                ["chart", BarChart3, "Chart"],
                ["table", Table2, "Table"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  "flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  view === v && "bg-accent text-foreground",
                )}
                title={`${label} view`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="sr-only">{label} view</span>
              </button>
            ))}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        {view === "chart" ? chart : <div className="max-h-80 overflow-auto px-2">{table}</div>}
      </CardContent>
    </Card>
  );
}
