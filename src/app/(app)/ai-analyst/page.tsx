import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Eye } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { AnalystChat } from "@/components/features/analyst-chat";
import { BriefingCard } from "@/components/features/briefing-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dataSufficiency } from "@/lib/ai/context";
import { loadAnalystContext } from "@/lib/ai/load";
import { getLatestBriefing } from "@/lib/data/insights";
import { getAiEnv } from "@/lib/env";

export const metadata: Metadata = { title: "AI analyst" };
// AI requests can take a while; give Server Actions on this page room to finish.
export const maxDuration = 120;

export default async function AiAnalystPage() {
  const ai = getAiEnv();
  const [{ context }, briefing] = await Promise.all([loadAnalystContext(), getLatestBriefing()]);
  const sufficiency = dataSufficiency(context);
  const observationCount = context.priceHistory.reduce((n, p) => n + p.totalObservations, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="AI analyst"
        description="Analysis of your own records. It can't see live prices and never trades for you."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="gap-2 py-4">
          <CardContent className="flex items-start gap-3 text-sm">
            {ai ? (
              <CheckCircle2 className="mt-0.5 size-4 text-gain" aria-hidden="true" />
            ) : (
              <CircleAlert className="mt-0.5 size-4 text-warning" aria-hidden="true" />
            )}
            <div>
              <p className="font-medium">{ai ? "AI analyst available" : "AI provider not configured"}</p>
              <p className="text-xs text-muted-foreground">
                {ai
                  ? `Using ${ai.model} with structured, validated responses.`
                  : "Briefings fall back to an automated, rule-based summary. Questions are unavailable."}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardContent className="flex items-start gap-3 text-sm">
            <Eye className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">What the analyst sees</p>
              <p className="text-xs text-muted-foreground">
                {context.holdings.length} holdings, {context.priceHistory.length} players with price history ({observationCount}{" "}
                observations), {context.tradeStats.allTime.sales} sales, {context.watchlist.length} watchlist entries. No email or
                account details. <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!sufficiency.sufficient && (
        <p className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm">{sufficiency.reason}</p>
      )}

      <BriefingCard briefing={briefing} aiConfigured={Boolean(ai)} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ask about your records</CardTitle>
          <CardDescription className="text-xs">
            Answers cite the figures they rely on and say when the data isn&apos;t enough. Conversations aren&apos;t saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnalystChat enabled={Boolean(ai)} />
        </CardContent>
      </Card>
    </div>
  );
}
