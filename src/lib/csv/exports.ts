import "server-only";
import type { PortfolioData } from "@/lib/data/queries";
import type { Observation } from "@/lib/domain";
import { realizedTrades } from "@/lib/finance";
import type { CsvValue } from "./write";

/**
 * Export shapes. Column names match the import format, so an export can be
 * re-imported (holdings → one row per open purchase; trades → one row per sale
 * plus one for any unsold remainder, which preserves every cost and P&L figure).
 */

type Rows = { columns: string[]; rows: Record<string, CsvValue>[] };

export function playersExport(p: PortfolioData): Rows {
  return {
    columns: ["name", "version", "rating", "position", "club", "league", "nation", "rarity"],
    rows: [...p.players.values()].map((pl) => ({
      name: pl.name,
      version: pl.version,
      rating: pl.rating,
      position: pl.position,
      club: pl.club,
      league: pl.league,
      nation: pl.nation,
      rarity: pl.rarity,
    })),
  };
}

export function holdingsExport(p: PortfolioData): Rows {
  const notes = new Map(p.trades.map((t) => [t.id, t.notes]));
  return {
    columns: ["player", "version", "quantity", "unit_cost", "acquired_at", "notes", "latest_price", "latest_observed_at"],
    rows: p.lots
      .filter((l) => l.remainingQuantity > 0)
      .map((l) => {
        const pl = p.players.get(l.lot.playerId);
        const latest = p.latestPrices.get(l.lot.playerId);
        return {
          player: pl?.name ?? "",
          version: pl?.version ?? "",
          quantity: l.remainingQuantity,
          unit_cost: l.lot.unitCost,
          acquired_at: l.lot.acquiredAt,
          notes: notes.get(l.lot.id) ?? null,
          latest_price: latest?.price ?? null,
          latest_observed_at: latest?.observedAt ?? null,
        };
      }),
  };
}

export function tradesExport(p: PortfolioData): Rows {
  const notes = new Map(p.trades.map((t) => [t.id, t.notes]));
  const player = (id: string) => p.players.get(id);
  // Sold rows come straight from the finance module's per-sale records.
  const rows: Record<string, CsvValue>[] = realizedTrades(p.lots).map((t) => ({
    player: player(t.playerId)?.name ?? "",
    version: player(t.playerId)?.version ?? "",
    quantity: t.quantity,
    buy_price: t.unitCost,
    bought_at: t.acquiredAt,
    sale_price: t.unitPrice,
    sold_at: t.soldAt,
    tax_rate: t.taxRate,
    tax: t.tax,
    net_proceeds: t.netProceeds,
    net_profit: t.profit,
    notes: notes.get(t.tradeId) ?? null,
  }));
  for (const l of p.lots) {
    if (l.remainingQuantity === 0) continue;
    rows.push({
      player: player(l.lot.playerId)?.name ?? "",
      version: player(l.lot.playerId)?.version ?? "",
      quantity: l.remainingQuantity,
      buy_price: l.lot.unitCost,
      bought_at: l.lot.acquiredAt,
      notes: notes.get(l.lot.id) ?? null,
    });
  }
  return {
    columns: ["player", "version", "quantity", "buy_price", "bought_at", "sale_price", "sold_at", "tax_rate", "tax", "net_proceeds", "net_profit", "notes"],
    rows,
  };
}

export function observationsExport(p: PortfolioData, observations: Observation[]): Rows {
  return {
    columns: ["player", "version", "price", "observed_at", "source", "notes"],
    rows: observations.map((o) => {
      const pl = p.players.get(o.playerId);
      return { player: pl?.name ?? "", version: pl?.version ?? "", price: o.price, observed_at: o.observedAt, source: o.source, notes: o.notes };
    }),
  };
}

export function adjustmentsExport(p: PortfolioData): Rows {
  return {
    columns: ["amount", "reason", "occurred_at"],
    rows: p.adjustments.map((a) => ({ amount: a.amount, reason: a.reason, occurred_at: a.occurredAt })),
  };
}
