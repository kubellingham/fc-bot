import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell, Eye, Pencil, ShoppingCart, Tag } from "lucide-react";
import { KpiCard } from "@/components/app/kpi-card";
import { Coins, Delta, PercentDelta } from "@/components/app/money";
import { PriceAge } from "@/components/app/price-age";
import { AlertFormDialog } from "@/components/features/alert-dialog";
import { AlertsList } from "@/components/features/alerts-list";
import { LotsList } from "@/components/features/lots-list";
import { ObservationDialog } from "@/components/features/observation-dialog";
import { PlayerDialog } from "@/components/features/player-dialog";
import { PlayerPricePanel } from "@/components/features/player-price-panel";
import { SaleDialog } from "@/components/features/sale-dialog";
import { TradeDialog } from "@/components/features/trade-dialog";
import { WatchlistDialog } from "@/components/features/watchlist-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { alertRows } from "@/lib/data/alert-views";
import { getAlerts, getObservations, getPlayerMap, getPlayers, getPortfolio, getWatchlist } from "@/lib/data/queries";
import { holdingRows, tradeRows } from "@/lib/data/views";
import { playerLabel } from "@/lib/domain";
import { createFormatter } from "@/lib/format";
import { priceChangeOverWindow, priceChangeSincePrevious, priceStats, priceTrend, positionProfitAtPrice } from "@/lib/finance";
import { uuid } from "@/lib/validation/schemas";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return { title: "Player" };
  const player = (await getPlayerMap()).get(id);
  return { title: player ? playerLabel(player) : "Player" };
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [players, playerMap, portfolio, watchlist, alerts] = await Promise.all([
    getPlayers(),
    getPlayerMap(),
    getPortfolio(),
    getWatchlist(),
    getAlerts(),
  ]);
  const player = playerMap.get(id);
  if (!player) notFound();

  const observations = await getObservations({ playerIds: [id] });
  const { settings } = portfolio;
  const f = createFormatter({ locale: settings.numberLocale, compact: settings.compactNumbers, timeZone: settings.timezone });
  const label = playerLabel(player);
  const holding = holdingRows(portfolio).find((h) => h.playerId === id) ?? null;
  const lots = tradeRows(portfolio).filter((t) => t.playerId === id);
  const watch = watchlist.find((w) => w.playerId === id) ?? null;
  const playerAlerts = alertRows(alerts.filter((a) => a.playerId === id), playerMap, observations);

  const latest = observations.at(-1) ?? null;
  const changes = [
    { label: "vs previous", change: priceChangeSincePrevious(observations) },
    { label: "24h", change: priceChangeOverWindow(observations, 24) },
    { label: "7d", change: priceChangeOverWindow(observations, 24 * 7) },
    { label: "30d", change: priceChangeOverWindow(observations, 24 * 30) },
  ];
  const recent = latest ? observations.filter((o) => Date.parse(o.observedAt) >= Date.parse(latest.observedAt) - 30 * 86_400_000) : [];
  const stats = priceStats(recent);
  const trend = priceTrend(recent);
  const sellTargetProfit =
    holding && watch?.targetSellPrice
      ? positionProfitAtPrice(holding.totalCost, holding.quantity, watch.targetSellPrice, settings.taxRate)
      : null;

  const recordPrice = (
    <ObservationDialog players={players} defaultPlayerId={id} trigger={<Button size="sm" variant="outline"><Tag />Record price</Button>} />
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link href="/players" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Players
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{player.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{player.version}</Badge>
              {[player.rating && `${player.rating} OVR`, player.position, player.club, player.league, player.nation, player.rarity]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {recordPrice}
            <TradeDialog players={players} taxRate={settings.taxRate} defaultPlayerId={id} trigger={<Button size="sm"><ShoppingCart />Record purchase</Button>} />
            <WatchlistDialog
              players={players}
              item={watch ?? undefined}
              defaultPlayerId={id}
              trigger={<Button size="sm" variant="outline"><Eye />{watch ? "Edit targets" : "Watch"}</Button>}
            />
            <AlertFormDialog players={players} defaultPlayerId={id} trigger={<Button size="sm" variant="outline"><Bell />Alert</Button>} />
            <PlayerDialog player={player} trigger={<Button size="icon-sm" variant="ghost" aria-label="Edit player details"><Pencil /></Button>} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Latest price"
          value={<Coins value={latest?.price ?? null} />}
          sub={<PriceAge observedAt={latest?.observedAt} />}
          info="The most recent price you recorded. Prices never update automatically."
        />
        <KpiCard
          label="30-day range"
          value={stats ? <span className="text-xl">{f.coins(stats.min)} – {f.coins(stats.max)}</span> : "—"}
          sub={stats ? `Avg ${f.coins(stats.mean)} · ${stats.count} obs.` : "Needs observations"}
          info="Minimum, maximum and mean of your observations in the 30 days up to the latest one."
        />
        <KpiCard
          label="Trend (30d)"
          value={
            trend ? (
              <span className="text-xl capitalize">
                {trend.direction} <PercentDelta value={trend.percentPerDay} className="text-base" />
                <span className="text-sm font-normal text-muted-foreground">/day</span>
              </span>
            ) : (
              "—"
            )
          }
          sub={trend ? `Fit R² ${trend.rSquared.toFixed(2)} — ${trend.rSquared < 0.5 ? "weak, noisy data" : "consistent"}` : "Needs 3+ observations over 1+ day"}
          info="Least-squares slope of recorded prices as % of the mean per day. R² shows how well a straight line fits."
        />
        <KpiCard
          label="Volatility (30d)"
          value={stats?.volatilityPercent != null ? f.percent(stats.volatilityPercent) : "—"}
          sub="Std. deviation ÷ mean"
          info="How widely your recorded prices vary around their average. Higher means riskier."
        />
      </div>

      <Card className="gap-2 py-4">
        <CardContent className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {changes.map(({ label: l, change }) => (
            <div key={l} className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground uppercase">{l}</span>
              {change ? (
                <span title={`${f.coins(change.fromPrice)} → ${f.coins(change.toPrice)}`}>
                  <PercentDelta value={change.percentChange} />{" "}
                  <span className="text-xs text-muted-foreground">({f.signedCoins(change.absoluteChange)})</span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">not enough history</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <PlayerPricePanel
        observations={observations}
        targetBuy={watch?.targetBuyPrice ?? null}
        targetSell={watch?.targetSellPrice ?? null}
        averageCost={holding ? Math.round(holding.averageCost) : null}
        recordButton={recordPrice}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Your position</CardTitle>
            <CardDescription className="text-xs">
              {holding
                ? `${holding.quantity} held across ${holding.openLots.length} purchase${holding.openLots.length === 1 ? "" : "s"}`
                : "Not currently held"}
            </CardDescription>
            {holding && (
              <CardAction>
                <SaleDialog
                  target={{ playerId: id }}
                  lots={holding.openLots}
                  taxRate={settings.taxRate}
                  playerName={label}
                  defaultPrice={holding.latestPrice}
                  trigger={<Button size="sm" variant="outline">Sell</Button>}
                />
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="grid gap-4">
            {holding && (
              <dl className="grid grid-cols-2 gap-y-1 text-sm tabular sm:grid-cols-4">
                <dt className="text-muted-foreground">Avg cost</dt>
                <dd className="text-right sm:text-left">{f.coins(holding.averageCost)}</dd>
                <dt className="text-muted-foreground">Break-even</dt>
                <dd className="text-right sm:text-left">{f.coins(holding.breakEvenPrice)}</dd>
                <dt className="text-muted-foreground">Est. value</dt>
                <dd className="text-right sm:text-left">{f.coins(holding.liquidationValue)}</dd>
                <dt className="text-muted-foreground">Unrealized</dt>
                <dd className="text-right sm:text-left">
                  <Delta value={holding.unrealizedProfit} percent={holding.unrealizedRoiPercent} />
                </dd>
              </dl>
            )}
            {sellTargetProfit && (
              <p className="text-xs text-muted-foreground">
                Selling all {holding!.quantity} at your target of {f.coins(watch!.targetSellPrice)} would make{" "}
                <Delta value={sellTargetProfit.netProfit} percent={sellTargetProfit.roiPercent} showIcon={false} /> after tax.
              </p>
            )}
            {lots.length > 0 ? (
              <LotsList rows={lots} players={players} taxRate={settings.taxRate} />
            ) : (
              <p className="text-sm text-muted-foreground">No purchases recorded for this player.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Watchlist & alerts</CardTitle>
            <CardDescription className="text-xs">
              {watch
                ? `Buy target ${f.coins(watch.targetBuyPrice)} · Sell target ${f.coins(watch.targetSellPrice)}${watch.archivedAt ? " · archived" : ""}`
                : "Not on your watchlist"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {playerAlerts.length > 0 ? (
              <AlertsList rows={playerAlerts} showPlayer={false} />
            ) : (
              <p className="text-sm text-muted-foreground">No alerts for this player yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
