import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { AlertEventsList } from "@/components/features/alert-events";
import { BriefingCard } from "@/components/features/briefing-card";
import { RecentActivity, WatchlistSummary } from "@/components/features/dashboard-lists";
import { Onboarding } from "@/components/features/onboarding";
import { PerformancePanel } from "@/components/features/performance-panel";
import { PortfolioKpis } from "@/components/features/portfolio-kpis";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestBriefing } from "@/lib/data/insights";
import { getAlertEvents, getAlerts, getAllObservations, getPortfolio, getWatchlist } from "@/lib/data/queries";
import { recentActivity } from "@/lib/data/views";
import { watchRows } from "@/lib/data/watch-views";
import { getAiEnv } from "@/lib/env";
import { cumulativeProfitByDay, portfolioValueSeries, realizedTrades } from "@/lib/finance";

export const metadata: Metadata = { title: "Dashboard" };
export const maxDuration = 120;

const DAY_MS = 86_400_000;

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="text-xs">
      <Link href={href}>
        {label}
        <ArrowRight />
      </Link>
    </Button>
  );
}

export default async function DashboardPage() {
  const [portfolio, observations, watchlist, alerts, events, briefing] = await Promise.all([
    getPortfolio(),
    getAllObservations(),
    getWatchlist(),
    getAlerts(),
    getAlertEvents(5),
    getLatestBriefing(),
  ]);
  const { settings, summary } = portfolio;
  const now = new Date();
  const range = { start: new Date(now.getTime() - 89 * DAY_MS), end: now };

  const valueSeries = portfolioValueSeries({
    startingBalance: settings.startingCoinBalance,
    adjustments: portfolio.adjustments,
    lots: portfolio.trades,
    sales: portfolio.sales,
    observations,
    taxRate: settings.taxRate,
    timeZone: settings.timezone,
    range,
  });
  const cumulative = new Map(cumulativeProfitByDay(realizedTrades(portfolio.lots), settings.timezone, range).map((c) => [c.key, c.cumulativeProfit]));
  const points = valueSeries.map((p) => ({
    key: p.key,
    portfolioValue: p.portfolioValue,
    availableCoins: p.availableCoins,
    holdingsValue: p.holdingsValue,
    cumulativeProfit: cumulative.get(p.key) ?? 0,
  }));

  const watch = watchRows(watchlist.filter((w) => !w.archivedAt), portfolio.players, observations)
    .sort((a, b) => Number(b.atBuyTarget || b.atSellTarget) - Number(a.atBuyTarget || a.atSellTarget))
    .slice(0, 5);
  const activeAlerts = alerts.filter((a) => a.isActive).length;
  const unread = events.filter((e) => !e.readAt).length;
  const isNew = portfolio.players.size === 0 || portfolio.trades.length === 0 || observations.length === 0 || !settings.persisted;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={settings.displayName ? `Welcome back, ${settings.displayName}` : "Dashboard"}
        description="Your portfolio at a glance. Values use the prices you've recorded, after the EA tax."
      />
      {isNew && (
        <Onboarding
          hasBalance={settings.persisted && settings.startingCoinBalance > 0}
          hasPlayers={portfolio.players.size > 0}
          hasTrades={portfolio.trades.length > 0}
          hasPrices={observations.length > 0}
        />
      )}
      <PortfolioKpis summary={summary} />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <PerformancePanel points={points} />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent transactions</CardTitle>
            <CardAction>
              <ViewAll href="/trading" label="Journal" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <RecentActivity items={recentActivity(portfolio, 6)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Watchlist</CardTitle>
            <CardDescription className="text-xs">Players at a target are listed first</CardDescription>
            <CardAction>
              <ViewAll href="/watchlist" label="All" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <WatchlistSummary rows={watch} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Price alerts</CardTitle>
            <CardDescription className="text-xs">
              {activeAlerts} active · {unread} unread
            </CardDescription>
            <CardAction>
              <ViewAll href="/alerts" label="Manage" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <AlertEventsList events={events} compact />
          </CardContent>
        </Card>
      </div>

      <BriefingCard briefing={briefing} aiConfigured={Boolean(getAiEnv())} compact />
    </div>
  );
}
