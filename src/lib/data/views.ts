import "server-only";
import type { OpenLot } from "@/components/features/sale-dialog";
import { playerLabel, type Player } from "@/lib/domain";
import { realizedTrades, type LotStatus } from "@/lib/finance";
import type { PortfolioData } from "./queries";

/**
 * Serializable row models for client tables. All numbers here come from the
 * finance module — client components only format and sort them.
 */

export interface HoldingRow {
  playerId: string;
  label: string;
  position: string | null;
  club: string | null;
  league: string | null;
  quantity: number;
  averageCost: number;
  totalCost: number;
  latestPrice: number | null;
  latestObservedAt: string | null;
  marketValue: number | null;
  liquidationValue: number | null;
  unrealizedProfit: number | null;
  unrealizedRoiPercent: number | null;
  breakEvenPrice: number;
  openLots: OpenLot[];
}

const UNKNOWN_PLAYER: Pick<Player, "name" | "version" | "position" | "club" | "league"> = {
  name: "Unknown player",
  version: "Base",
  position: null,
  club: null,
  league: null,
};

export function holdingRows(p: PortfolioData): HoldingRow[] {
  return p.holdings
    .map((h) => {
      const player = p.players.get(h.playerId) ?? UNKNOWN_PLAYER;
      const openLots = p.lots
        .filter((l) => l.lot.playerId === h.playerId && l.remainingQuantity > 0)
        .map((l) => ({
          id: l.lot.id,
          remainingQuantity: l.remainingQuantity,
          unitCost: l.lot.unitCost,
          acquiredAt: l.lot.acquiredAt,
          createdAt: l.lot.createdAt,
        }));
      return {
        playerId: h.playerId,
        label: playerLabel(player),
        position: player.position,
        club: player.club,
        league: player.league,
        quantity: h.quantity,
        averageCost: h.averageCost,
        totalCost: h.totalCost,
        latestPrice: h.latestPrice,
        latestObservedAt: h.latestObservedAt,
        marketValue: h.marketValue,
        liquidationValue: h.liquidationValue,
        unrealizedProfit: h.unrealizedProfit,
        unrealizedRoiPercent: h.unrealizedRoiPercent,
        breakEvenPrice: h.breakEvenPrice,
        openLots,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);
}

export interface TradeSaleRow {
  id: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  soldAt: string;
  notes: string | null;
}

export interface TradeRow {
  id: string;
  playerId: string;
  label: string;
  position: string | null;
  status: LotStatus;
  quantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  acquiredAt: string;
  averageSalePrice: number | null;
  lastSoldAt: string | null;
  tax: number;
  grossProceeds: number;
  netProceeds: number;
  costOfSold: number;
  realizedProfit: number;
  realizedRoiPercent: number | null;
  notes: string | null;
  sales: TradeSaleRow[];
}

export function tradeRows(p: PortfolioData): TradeRow[] {
  const notesById = new Map(p.trades.map((t) => [t.id, t.notes]));
  const saleNotes = new Map(p.sales.map((s) => [s.id, s.notes]));
  return p.lots
    .map((l) => {
      const player = p.players.get(l.lot.playerId) ?? UNKNOWN_PLAYER;
      return {
        id: l.lot.id,
        playerId: l.lot.playerId,
        label: playerLabel(player),
        position: player.position,
        status: l.status,
        quantity: l.lot.quantity,
        soldQuantity: l.soldQuantity,
        remainingQuantity: l.remainingQuantity,
        unitCost: l.lot.unitCost,
        acquiredAt: l.lot.acquiredAt,
        averageSalePrice: l.averageSalePrice,
        lastSoldAt: l.lastSoldAt,
        tax: l.tax,
        grossProceeds: l.grossProceeds,
        netProceeds: l.netProceeds,
        costOfSold: l.costOfSold,
        realizedProfit: l.realizedProfit,
        realizedRoiPercent: l.realizedRoiPercent,
        notes: notesById.get(l.lot.id) ?? null,
        sales: l.sales
          .map((s) => ({ id: s.id, quantity: s.quantity, unitPrice: s.unitPrice, taxRate: s.taxRate, soldAt: s.soldAt, notes: saleNotes.get(s.id) ?? null }))
          .sort((a, b) => Date.parse(b.soldAt) - Date.parse(a.soldAt)),
      };
    })
    .sort((a, b) => Date.parse(b.lastSoldAt ?? b.acquiredAt) - Date.parse(a.lastSoldAt ?? a.acquiredAt));
}

export interface ActivityItem {
  id: string;
  kind: "buy" | "sell";
  playerId: string;
  label: string;
  quantity: number;
  unitPrice: number;
  at: string;
  /** Sales only: net profit of this sale. */
  profit: number | null;
}

/** Most recent purchases and sales, newest first. Sale profit comes from the finance module. */
export function recentActivity(p: PortfolioData, limit = 8): ActivityItem[] {
  const label = (playerId: string) => playerLabel(p.players.get(playerId) ?? UNKNOWN_PLAYER);
  const buys: ActivityItem[] = p.lots.map((l) => ({
    id: `b-${l.lot.id}`,
    kind: "buy",
    playerId: l.lot.playerId,
    label: label(l.lot.playerId),
    quantity: l.lot.quantity,
    unitPrice: l.lot.unitCost,
    at: l.lot.acquiredAt,
    profit: null,
  }));
  const sells: ActivityItem[] = realizedTrades(p.lots).map((t) => ({
    id: `s-${t.saleId}`,
    kind: "sell",
    playerId: t.playerId,
    label: label(t.playerId),
    quantity: t.quantity,
    unitPrice: t.unitPrice,
    at: t.soldAt,
    profit: t.profit,
  }));
  return [...buys, ...sells].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}
