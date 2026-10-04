"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Lightbulb, RefreshCw, ScanSearch, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { DateTime } from "@/components/app/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { generateBriefing } from "@/lib/actions/ai";
import type { InsightItem } from "@/lib/ai/schemas";
import type { SavedBriefing } from "@/lib/data/insights";
import { cn } from "@/lib/utils";

const CONFIDENCE = {
  low: { label: "Low confidence", variant: "warning" },
  medium: { label: "Medium confidence", variant: "info" },
  high: { label: "High confidence", variant: "gain" },
} as const;

function Section({ title, icon, items }: { title: string; icon: React.ReactNode; items: InsightItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {icon}
        {title}
      </h3>
      <ul className="grid gap-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm">
            <p>{item.statement}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Why: {item.evidence}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BriefingCard({
  briefing,
  aiConfigured,
  compact = false,
}: {
  briefing: SavedBriefing | null;
  aiConfigured: boolean;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const generate = () =>
    start(async () => {
      setError(null);
      try {
        const r = await generateBriefing({});
        if (!r) return;
        if (!r.ok) setError(r.error);
        else if (r.data.notice) toast.info(r.data.notice);
        else toast.success("Briefing updated.");
      } catch {
        setError("We couldn't reach the server. Please try again.");
      }
    });

  return (
    <Card aria-busy={pending}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Market briefing
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
          {briefing ? (
            <>
              <Badge variant={briefing.source === "ai" ? "info" : "outline"}>{briefing.source === "ai" ? "AI analysis" : "Automated summary"}</Badge>
              <Badge variant={CONFIDENCE[briefing.briefing.confidence].variant}>{CONFIDENCE[briefing.briefing.confidence].label}</Badge>
              <span>
                Generated <DateTime iso={briefing.generatedAt} relative />
              </span>
            </>
          ) : (
            <span>{aiConfigured ? "Ask the AI analyst to review your records." : "Generate an automated summary of your records."}</span>
          )}
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={generate} disabled={pending}>
            <RefreshCw className={cn(pending && "animate-spin")} />
            {pending ? "Analysing…" : briefing ? "Refresh" : "Generate"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className={cn("grid gap-4", pending && "opacity-60")}>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        {!briefing && pending && (
          <div className="grid gap-2" aria-label="Generating briefing">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {briefing && (
          <>
            <p className="text-sm leading-relaxed">{briefing.briefing.summary}</p>
            <div className={cn("grid gap-4", !compact && "md:grid-cols-3")}>
              <Section title="Observations" icon={<ScanSearch className="size-3.5" />} items={briefing.briefing.observations.slice(0, compact ? 3 : 8)} />
              <Section title="Risks" icon={<TriangleAlert className="size-3.5" />} items={briefing.briefing.risks.slice(0, compact ? 2 : 6)} />
              <Section title="Worth checking" icon={<Lightbulb className="size-3.5" />} items={briefing.briefing.opportunities.slice(0, compact ? 2 : 6)} />
            </div>
            {briefing.briefing.dataLimitations.length > 0 && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Limitations</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {briefing.briefing.dataLimitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <p className="text-[11px] text-muted-foreground">
          Based only on prices and trades you recorded — not live market data. Not financial advice; no outcome is guaranteed.
        </p>
      </CardContent>
    </Card>
  );
}
