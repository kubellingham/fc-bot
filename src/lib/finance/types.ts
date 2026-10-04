/**
 * Domain records consumed by the finance module. Timestamps are ISO-8601 strings.
 * These mirror the database tables but use camelCase and plain numbers.
 */

/** A purchase of one or more copies of a player at a single unit price (a "lot"). */
export interface LotRecord {
  id: string;
  playerId: string;
  quantity: number;
  unitCost: number;
  acquiredAt: string;
}

/** A sale of some copies from a specific lot. `taxRate` is the rate in force when the sale was recorded. */
export interface SaleRecord {
  id: string;
  tradeId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  soldAt: string;
}

/** A manually recorded market price for a player. */
export interface PriceObservation {
  id: string;
  playerId: string;
  price: number;
  observedAt: string;
}

/** Coins gained or spent outside of trading (rewards, packs, reconciliation). */
export interface CoinAdjustment {
  id: string;
  amount: number;
  occurredAt: string;
}

export interface LatestPrice {
  price: number;
  observedAt: string;
}
