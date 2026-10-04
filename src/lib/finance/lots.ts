import { BPS_SCALE, FinanceInputError, assertQuantity, assertWholeCoins, percentOf, unitsToCoins } from "./money";
import { saleProceedsUnits } from "./tax";
import type { LotRecord, SaleRecord } from "./types";

export type LotStatus = "open" | "partial" | "closed";

export interface LotSummary {
  lot: LotRecord;
  sales: SaleRecord[];
  soldQuantity: number;
  remainingQuantity: number;
  status: LotStatus;
  /** Purchase cost of the copies that have been sold. */
  costOfSold: number;
  /** Purchase cost of the copies still held. */
  remainingCost: number;
  grossProceeds: number;
  tax: number;
  netProceeds: number;
  /** Net proceeds − cost of sold copies. Zero when nothing has been sold. */
  realizedProfit: number;
  /** realizedProfit ÷ costOfSold × 100. Null when nothing was sold or the sold copies cost nothing. */
  realizedRoiPercent: number | null;
  /** Quantity-weighted average sale price, or null when nothing was sold. */
  averageSalePrice: number | null;
  lastSoldAt: string | null;
  /** Fixed-point internals, used for exact aggregation across lots. */
  units: { costOfSold: number; remainingCost: number; gross: number; tax: number; net: number; profit: number };
}

/**
 * Summarises one lot and the sales recorded against it.
 * Throws if the sales reference another lot or sell more copies than were bought.
 */
export function summarizeLot(lot: LotRecord, sales: readonly SaleRecord[]): LotSummary {
  assertQuantity(lot.quantity, "Lot quantity");
  assertWholeCoins(lot.unitCost, "Purchase price");

  let soldQuantity = 0;
  let gross = 0;
  let tax = 0;
  let net = 0;
  let saleValue = 0;
  let lastSoldAt: string | null = null;

  for (const sale of sales) {
    if (sale.tradeId !== lot.id) {
      throw new FinanceInputError("A sale was attributed to the wrong trade.");
    }
    assertQuantity(sale.quantity, "Sale quantity");
    assertWholeCoins(sale.unitPrice, "Sale price", { min: 1 });
    const proceeds = saleProceedsUnits(sale.unitPrice, sale.quantity, sale.taxRate);
    soldQuantity += sale.quantity;
    gross += proceeds.gross;
    tax += proceeds.tax;
    net += proceeds.net;
    saleValue += sale.unitPrice * sale.quantity;
    if (lastSoldAt === null || Date.parse(sale.soldAt) > Date.parse(lastSoldAt)) {
      lastSoldAt = sale.soldAt;
    }
  }

  if (soldQuantity > lot.quantity) {
    throw new FinanceInputError(`Sold quantity (${soldQuantity}) exceeds purchased quantity (${lot.quantity}).`);
  }

  const remainingQuantity = lot.quantity - soldQuantity;
  const costOfSoldUnits = lot.unitCost * soldQuantity * BPS_SCALE;
  const remainingCostUnits = lot.unitCost * remainingQuantity * BPS_SCALE;
  const profitUnits = net - costOfSoldUnits;

  return {
    lot,
    sales: [...sales],
    soldQuantity,
    remainingQuantity,
    status: soldQuantity === 0 ? "open" : remainingQuantity === 0 ? "closed" : "partial",
    costOfSold: unitsToCoins(costOfSoldUnits),
    remainingCost: unitsToCoins(remainingCostUnits),
    grossProceeds: unitsToCoins(gross),
    tax: unitsToCoins(tax),
    netProceeds: unitsToCoins(net),
    realizedProfit: unitsToCoins(profitUnits),
    realizedRoiPercent: soldQuantity === 0 ? null : percentOf(profitUnits, costOfSoldUnits),
    averageSalePrice: soldQuantity === 0 ? null : saleValue / soldQuantity,
    lastSoldAt,
    units: {
      costOfSold: costOfSoldUnits,
      remainingCost: remainingCostUnits,
      gross,
      tax,
      net,
      profit: profitUnits,
    },
  };
}

/** Groups sales by lot and summarises every lot. Sales for unknown lots raise an error. */
export function summarizeLots(lots: readonly LotRecord[], sales: readonly SaleRecord[]): LotSummary[] {
  const byTrade = new Map<string, SaleRecord[]>();
  for (const lot of lots) byTrade.set(lot.id, []);
  for (const sale of sales) {
    const bucket = byTrade.get(sale.tradeId);
    if (!bucket) throw new FinanceInputError("A sale references a trade that was not loaded.");
    bucket.push(sale);
  }
  return lots.map((lot) => summarizeLot(lot, byTrade.get(lot.id) ?? []));
}

export interface FifoCandidate {
  id: string;
  remainingQuantity: number;
  acquiredAt: string;
  /** Recording time; the tie-breaker when purchase times are equal. */
  createdAt?: string;
}

export interface FifoAllocation {
  lotId: string;
  quantity: number;
}

export class InsufficientQuantityError extends FinanceInputError {
  constructor(public readonly available: number, public readonly requested: number) {
    super(`Only ${available} ${available === 1 ? "copy is" : "copies are"} held; cannot sell ${requested}.`);
    this.name = "InsufficientQuantityError";
  }
}

/**
 * Allocates a sale across open lots, oldest purchase first (FIFO).
 * Ties on purchase time are broken by when the purchase was recorded, then by
 * id, so the result is deterministic.
 */
export function allocateFifo(candidates: readonly FifoCandidate[], quantity: number): FifoAllocation[] {
  assertQuantity(quantity);
  const open = candidates
    .filter((c) => c.remainingQuantity > 0)
    .sort(
      (a, b) =>
        Date.parse(a.acquiredAt) - Date.parse(b.acquiredAt) ||
        (a.createdAt && b.createdAt ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : 0) ||
        a.id.localeCompare(b.id),
    );

  const available = open.reduce((sum, c) => sum + c.remainingQuantity, 0);
  if (available < quantity) throw new InsufficientQuantityError(available, quantity);

  const allocations: FifoAllocation[] = [];
  let left = quantity;
  for (const lot of open) {
    if (left === 0) break;
    const take = Math.min(left, lot.remainingQuantity);
    allocations.push({ lotId: lot.id, quantity: take });
    left -= take;
  }
  return allocations;
}
