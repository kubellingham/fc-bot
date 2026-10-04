import "server-only";
import { getAllObservations, getPortfolio, getWatchlist } from "@/lib/data/queries";
import { buildAnalystContext } from "./context";

/** Loads the signed-in user's records and builds the analyst context. */
export async function loadAnalystContext() {
  const [portfolio, observations, watchlist] = await Promise.all([getPortfolio(), getAllObservations(), getWatchlist()]);
  const context = buildAnalystContext({
    now: new Date(),
    settings: portfolio.settings,
    players: portfolio.players,
    lots: portfolio.lots,
    holdings: portfolio.holdings,
    summary: portfolio.summary,
    adjustments: portfolio.adjustments,
    observations,
    watchlist,
  });
  const s = portfolio.settings;
  return { context, prefs: { locale: s.numberLocale, compact: false, timeZone: s.timezone } };
}
