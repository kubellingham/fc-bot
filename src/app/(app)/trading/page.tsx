import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { KpiCard } from "@/components/app/kpi-card";
import { Delta } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { TradeDialog } from "@/components/features/trade-dialog";
import { TradeJournal } from "@/components/features/trade-journal";
import { Button } from "@/components/ui/button";
import { getPlayers, getPortfolio } from "@/lib/data/queries";
import { tradeRows } from "@/lib/data/views";
import { createFormatter } from "@/lib/format";
import { realizedTrades, tradeStats } from "@/lib/finance";

export const metadata: Metadata = { title: "Trade journal" };

export default async function TradingPage() {
  const [portfolio, players] = await Promise.all([getPortfolio(), getPlayers()]);
  const rows = tradeRows(portfolio);
  const stats = tradeStats(realizedTrades(portfolio.lots));
  const { settings } = portfolio;
  const f = createFormatter({ locale: settings.numberLocale, compact: settings.compactNumbers, timeZone: settings.timezone });
  const open = rows.filter((r) => r.status !== "closed").length;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Trade journal"
        description="Each purchase with its sales. Profit is after the EA tax rate in force when each sale was recorded."
        actions={
          players.length > 0 ? (
            <TradeDialog players={players} taxRate={settings.taxRate} trigger={<Button size="sm"><Plus />Record purchase</Button>} />
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Trades" value={f.number(rows.length)} sub={`${open} open or partly sold`} />
        <KpiCard label="Realized P&L" value={<Delta value={stats.totalProfit} />} sub={`${f.number(stats.count)} sales`} />
        <KpiCard label="Tax paid" value={f.coins(stats.totalTax)} info="Total EA transaction tax on recorded sales." />
        <KpiCard
          label="Win rate"
          value={f.percent(stats.winRatePercent)}
          sub={stats.count ? `${stats.wins} wins · ${stats.losses} losses · ${stats.breakeven} even` : "No sales yet"}
          info="Share of sales with a positive net profit. Break-even sales are not wins."
        />
      </div>
      <TradeJournal rows={rows} players={players} taxRate={settings.taxRate} />
    </div>
  );
}
