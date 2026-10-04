import { NextResponse, type NextRequest } from "next/server";
import {
  adjustmentsExport,
  holdingsExport,
  observationsExport,
  playersExport,
  tradesExport,
} from "@/lib/csv/exports";
import { toCsv } from "@/lib/csv/write";
import { getAuth } from "@/lib/data/auth";
import { getAlerts, getAllObservations, getPortfolio, getWatchlist } from "@/lib/data/queries";
import { errorFields, logger } from "@/lib/logger";

const ENTITIES = ["players", "holdings", "trades", "observations", "adjustments", "all"] as const;
type Entity = (typeof ENTITIES)[number];

/** Authenticated data export. Every query runs as the user, so RLS scopes it to their rows. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!(ENTITIES as readonly string[]).includes(entity)) {
    return NextResponse.json({ error: "Unknown export." }, { status: 404 });
  }
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const portfolio = await getPortfolio();
    const date = new Date().toISOString().slice(0, 10);
    const headers = (type: string, name: string) => ({
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="fc-market-${name}-${date}.${type.startsWith("text/csv") ? "csv" : "json"}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });

    if ((entity as Entity) === "all") {
      const [observations, watchlist, alerts] = await Promise.all([getAllObservations(), getWatchlist(), getAlerts()]);
      const body = {
        exportedAt: new Date().toISOString(),
        format: "fc-market-intelligence/v1",
        settings: portfolio.settings,
        players: [...portfolio.players.values()],
        trades: portfolio.trades,
        sales: portfolio.sales,
        coinAdjustments: portfolio.adjustments,
        priceObservations: observations,
        watchlist,
        alerts,
      };
      return new NextResponse(JSON.stringify(body, null, 2), { headers: headers("application/json", "export") });
    }

    const observations = entity === "observations" ? await getAllObservations() : [];
    const table =
      entity === "players"
        ? playersExport(portfolio)
        : entity === "holdings"
          ? holdingsExport(portfolio)
          : entity === "trades"
            ? tradesExport(portfolio)
            : entity === "observations"
              ? observationsExport(portfolio, observations)
              : adjustmentsExport(portfolio);
    return new NextResponse(toCsv(table.columns, table.rows), { headers: headers("text/csv; charset=utf-8", entity) });
  } catch (error) {
    logger.error("export.failed", { userId: auth.user.id, entity, ...errorFields(error) });
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
