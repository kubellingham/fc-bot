"use client";

import { Clock } from "lucide-react";
import { useFormatter, useNow } from "@/components/format-provider";
import { cn } from "@/lib/utils";

const STALE_HOURS = 24;

/**
 * Shows how old a manually recorded price is. Prices never update on their own,
 * so their age is always visible; anything older than a day is flagged.
 */
export function PriceAge({ observedAt, className }: { observedAt: string | null | undefined; className?: string }) {
  const f = useFormatter();
  const now = useNow();
  if (!observedAt) return <span className={cn("text-xs text-muted-foreground", className)}>No price recorded</span>;
  const stale = now - Date.parse(observedAt) > STALE_HOURS * 3_600_000;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs", stale ? "text-warning" : "text-muted-foreground", className)}
      title={`Recorded ${f.dateTime(observedAt)}${stale ? " — may be out of date" : ""}`}
    >
      <Clock className="size-3" aria-hidden="true" />
      {f.relative(observedAt, new Date(now))}
      {stale && <span className="sr-only"> (may be out of date)</span>}
    </span>
  );
}
