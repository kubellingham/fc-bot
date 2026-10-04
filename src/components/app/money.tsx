"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useFormatter, useNow } from "@/components/format-provider";
import { coinSign } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Whole-coin amount. */
export function Coins({ value, compact, className }: { value: number | null | undefined; compact?: boolean; className?: string }) {
  const f = useFormatter();
  return <span className={cn("tabular", className)}>{f.coins(value, { compact })}</span>;
}

/**
 * Signed gain/loss. Polarity is conveyed three ways — sign, arrow icon and
 * colour — so it never relies on colour alone.
 */
export function Delta({
  value,
  percent,
  compact,
  showIcon = true,
  className,
}: {
  value: number | null | undefined;
  percent?: number | null;
  compact?: boolean;
  showIcon?: boolean;
  className?: string;
}) {
  const f = useFormatter();
  if (value === null || value === undefined) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const sign = coinSign(value);
  const Icon = sign > 0 ? ArrowUpRight : sign < 0 ? ArrowDownRight : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular",
        sign > 0 && "text-gain",
        sign < 0 && "text-loss",
        sign === 0 && "text-muted-foreground",
        className,
      )}
    >
      {showIcon && Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      <span>{f.signedCoins(value, { compact })}</span>
      {percent !== undefined && percent !== null && (
        <span className="ml-1 opacity-80">({f.signedPercent(percent)})</span>
      )}
      <span className="sr-only">{sign > 0 ? " gain" : sign < 0 ? " loss" : ""}</span>
    </span>
  );
}

export function PercentDelta({ value, className }: { value: number | null | undefined; className?: string }) {
  const f = useFormatter();
  if (value === null || value === undefined) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const rounded = Math.round(value * 10) / 10;
  return (
    <span className={cn("tabular", rounded > 0 && "text-gain", rounded < 0 && "text-loss", rounded === 0 && "text-muted-foreground", className)}>
      {f.signedPercent(value)}
    </span>
  );
}

export function DateTime({ iso, relative = false, className }: { iso: string | null | undefined; relative?: boolean; className?: string }) {
  const f = useFormatter();
  const now = useNow();
  if (!iso) return <span className={className}>—</span>;
  return (
    <time dateTime={iso} title={f.dateTime(iso)} className={className}>
      {relative ? f.relative(iso, new Date(now)) : f.dateTime(iso)}
    </time>
  );
}

export function DateOnly({ iso, className }: { iso: string | null | undefined; className?: string }) {
  const f = useFormatter();
  return (
    <time dateTime={iso ?? undefined} className={className}>
      {f.date(iso)}
    </time>
  );
}
