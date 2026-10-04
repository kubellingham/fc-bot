"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Coins, Delta } from "@/components/app/money";
import { KpiCard } from "@/components/app/kpi-card";
import { useFormatter } from "@/components/format-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { PortfolioSummary } from "@/lib/finance";

/** Headline metrics. Each figure links to its documented definition via the info tooltip. */
export function PortfolioKpis({ summary, variant = "full" }: { summary: PortfolioSummary; variant?: "full" | "compact" }) {
  const f = useFormatter();
  return (
    <div className="grid gap-3">
      {summary.balanceIsNegative && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Your tracked coin balance is negative</AlertTitle>
          <AlertDescription>
            Recorded purchases exceed the coins on record. Set your starting balance in{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>{" "}
            or sync with your in-game balance on the Portfolio page.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Portfolio value"
          value={<Coins value={summary.portfolioValue} />}
          info="Available coins + estimated after-tax value of holdings. Unpriced holdings are counted at cost."
          sub={summary.unpricedHoldings > 0 ? `${summary.unpricedHoldings} unpriced, valued at cost` : "Coins + holdings after tax"}
        />
        <KpiCard
          label="Available coins"
          value={<Coins value={summary.availableCoins} />}
          info="Starting balance + adjustments − purchases + net sale proceeds. Coins not tied up in cards."
        />
        <KpiCard
          label="Invested"
          value={<Coins value={summary.investedCost} />}
          info="Purchase cost of every copy you still hold."
          sub={summary.capitalUtilizationPercent === null ? undefined : `${f.percent(summary.capitalUtilizationPercent)} of capital`}
        />
        <KpiCard
          label="Realized P&L"
          value={<Delta value={summary.realizedProfit} />}
          info="Profit from completed sales after the EA tax."
          sub={summary.realizedRoiPercent === null ? "No sales yet" : `${f.signedPercent(summary.realizedRoiPercent)} on sold cost`}
        />
        <KpiCard
          label="Unrealized P&L"
          value={<Delta value={summary.unrealizedProfit} />}
          info="Estimated profit if priced holdings sold at their latest recorded price, after tax. Excludes unpriced holdings."
          sub={summary.unrealizedRoiPercent === null ? "No priced holdings" : `${f.signedPercent(summary.unrealizedRoiPercent)} on priced cost`}
        />
        {variant === "full" && (
          <KpiCard
            label="Total ROI"
            value={<span>{f.signedPercent(summary.totalRoiPercent)}</span>}
            info="(Realized + unrealized P&L) ÷ (cost of sold copies + cost of priced holdings)."
            sub={
              <>
                Total P&L <Delta value={summary.totalProfit} showIcon={false} />
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
