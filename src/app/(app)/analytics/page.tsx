import type { Metadata } from "next";
import Link from "next/link";
import { KpiCard } from "@/components/app/kpi-card";
import { Delta } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import {
  CumulativePanel,
  PlayerPerformanceTable,
  PnlPanel,
  TradeHistoryTable,
  UtilizationPanel,
} from "@/components/features/analytics-panels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllObservations, getPortfolio } from "@/lib/data/queries";
import { playerLabel } from "@/lib/domain";
import {
  cumulativeProfitByDay,
  playerPerformance,
  portfolioValueSeries,
  profitByPeriod,
  realizedTrades,
  tradeStats,
  tradesSoldBetween,
} from "@/lib/finance";
import { createFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "365", label: "12 months", days: 365 },
  { value: "all", label: "All time", days: null },
] as const;

const DAY_MS = 86_400_000;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r.value === rangeParam) ?? RANGES[1];
  const [portfolio, observations] = await Promise.all([getPortfolio(), getAllObservations()]);
  const { settings, lots, players, summary } = portfolio;
  const tz = settings.timezone;
  const f = createFormatter({ locale: settings.numberLocale, compact: settings.compactNumbers, timeZone: tz });

  const now = new Date();
  const firstActivity = lots.reduce<number | null>((min, l) => {
    const t = Date.parse(l.lot.acquiredAt);
    return min === null || t < min ? t : min;
  }, null);
  const start =
    range.days !== null
      ? new Date(now.getTime() - (range.days - 1) * DAY_MS)
      : new Date(Math.min(firstActivity ?? now.getTime() - 29 * DAY_MS, now.getTime() - 6 * DAY_MS));

  const allTrades = realizedTrades(lots);
  const periodTrades = tradesSoldBetween(allTrades, start, now);
  const stats = tradeStats(periodTrades);
  const label = (id: string) => {
    const p = players.get(id);
    return p ? playerLabel(p) : "Unknown player";
  };

  const dailyStart = range.days !== null && range.days <= 90 ? start : new Date(now.getTime() - 89 * DAY_MS);
  const daily = profitByPeriod(allTrades, "day", tz, { start: dailyStart, end: now });
  const weekly = profitByPeriod(allTrades, "week", tz, { start, end: now });
  const monthly = profitByPeriod(allTrades, "month", tz, { start, end: now });
  const cumulative = cumulativeProfitByDay(allTrades, tz, { start, end: now });
  const utilization = portfolioValueSeries({
    startingBalance: settings.startingCoinBalance,
    adjustments: portfolio.adjustments,
    lots: portfolio.trades,
    sales: portfolio.sales,
    observations,
    taxRate: settings.taxRate,
    timeZone: tz,
    range: { start, end: now },
  }).map((p) => ({ key: p.key, value: p.capitalUtilizationPercent, invested: p.investedCost, available: p.availableCoins }));

  const perf = playerPerformance(periodTrades).map((p) => ({ ...p, label: label(p.playerId) }));
  const best = perf.filter((p) => p.profit > 0).slice(0, 5);
  const worst = perf.filter((p) => p.profit < 0).reverse().slice(0, 5);
  const history = [...periodTrades].reverse().map((t) => ({
    saleId: t.saleId,
    playerId: t.playerId,
    label: label(t.playerId),
    quantity: t.quantity,
    unitCost: t.unitCost,
    unitPrice: t.unitPrice,
    tax: t.tax,
    profit: t.profit,
    roiPercent: t.roiPercent,
    holdingHours: t.holdingHours,
    soldAt: t.soldAt,
  }));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Analytics"
        description={
          <>
            Realized performance from your recorded sales, bucketed in your time zone ({tz}).{" "}
            <Link href="/settings" className="underline underline-offset-2">
              Change
            </Link>
          </>
        }
      />

      <nav aria-label="Period" className="flex flex-wrap gap-1">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/analytics?range=${r.value}`}
            aria-current={r.value === range.value ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
              r.value === range.value && "border-primary/50 bg-primary/10 text-foreground",
            )}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Realized P&L" value={<Delta value={stats.totalProfit} />} sub={`${f.signedPercent(stats.roiPercent)} ROI on sold cost`} />
        <KpiCard
          label="Win rate"
          value={f.percent(stats.winRatePercent)}
          sub={stats.count ? `${stats.wins}W · ${stats.losses}L · ${stats.breakeven} even` : "No sales in period"}
          info="Sales with positive net profit ÷ all sales. Break-even counts as not a win."
        />
        <KpiCard label="Avg profit / sale" value={<Delta value={stats.averageProfit} />} sub={`${f.number(stats.count)} sales · ${f.number(stats.unitsSold)} cards`} />
        <KpiCard
          label="Avg holding time"
          value={f.duration(stats.averageHoldingHours)}
          info="Time from purchase to sale, weighted by the number of cards sold."
        />
        <KpiCard label="Tax paid" value={f.coins(stats.totalTax)} sub={`on ${f.coins(stats.totalNetProceeds + stats.totalTax)} of sales`} />
        <KpiCard
          label="Capital in use"
          value={f.percent(summary.capitalUtilizationPercent)}
          sub="Right now"
          info="Invested cost ÷ (available coins + invested cost)."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PnlPanel
          title="Daily P&L"
          description={range.days !== null && range.days <= 90 ? undefined : "Last 90 days"}
          data={daily}
          granularity="day"
        />
        <CumulativePanel data={cumulative} />
        <PnlPanel title="Weekly P&L" description="Weeks start on Monday." data={weekly} granularity="week" />
        <PnlPanel title="Monthly P&L" data={monthly} granularity="month" />
      </div>

      <UtilizationPanel data={utilization} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Best-performing players</CardTitle>
            <CardDescription className="text-xs">By realized profit in this period</CardDescription>
          </CardHeader>
          <CardContent>
            <PlayerPerformanceTable rows={best} empty="No profitable sales in this period." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Worst-performing players</CardTitle>
            <CardDescription className="text-xs">Largest realized losses in this period</CardDescription>
          </CardHeader>
          <CardContent>
            <PlayerPerformanceTable rows={worst} empty="No losing sales in this period." />
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="history" className="grid gap-3">
        <h2 id="history" className="text-sm font-medium">
          Trading history
        </h2>
        <TradeHistoryTable rows={history} />
        <p className="text-xs text-muted-foreground">
          Each row is one sale matched to the purchase it came from. Formulas are documented in docs/financial-formulas.md.
        </p>
      </section>
    </div>
  );
}
