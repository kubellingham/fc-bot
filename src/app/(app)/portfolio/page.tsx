import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { CoinLedger } from "@/components/features/coin-ledger";
import { HoldingsTable } from "@/components/features/holdings-table";
import { PortfolioKpis } from "@/components/features/portfolio-kpis";
import { getPlayers, getPortfolio } from "@/lib/data/queries";
import { holdingRows } from "@/lib/data/views";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const [portfolio, players] = await Promise.all([getPortfolio(), getPlayers()]);
  const rows = holdingRows(portfolio);
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Portfolio"
        description="What you hold, what it cost, and what it's worth at the prices you've recorded — after the EA tax."
      />
      <PortfolioKpis summary={portfolio.summary} />
      <section aria-labelledby="holdings-heading" className="grid gap-3">
        <h2 id="holdings-heading" className="text-sm font-medium">
          Holdings
        </h2>
        <HoldingsTable rows={rows} players={players} taxRate={portfolio.settings.taxRate} />
      </section>
      <CoinLedger
        startingBalance={portfolio.settings.startingCoinBalance}
        adjustments={portfolio.adjustments}
        availableCoins={portfolio.summary.availableCoins}
      />
    </div>
  );
}
