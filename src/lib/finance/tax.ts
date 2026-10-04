import {
  BPS_SCALE,
  FinanceInputError,
  assertQuantity,
  assertWholeCoins,
  ceilDiv,
  percentOf,
  toBps,
  unitsToCoins,
} from "./money";

export interface SaleProceeds {
  /** Sale price × quantity. */
  grossProceeds: number;
  /** grossProceeds × taxRate. May be fractional; never rounded here. */
  tax: number;
  /** grossProceeds − tax. */
  netProceeds: number;
}

/** Internal: proceeds in fixed-point units (1/10,000 coin). Exact integers. */
export function saleProceedsUnits(unitPrice: number, quantity: number, taxRate: number) {
  const bps = toBps(taxRate);
  const gross = unitPrice * quantity * BPS_SCALE;
  const tax = unitPrice * quantity * bps;
  return { gross, tax, net: gross - tax };
}

/**
 * Tax and net proceeds for selling `quantity` cards at `unitPrice` each.
 *
 *   Tax          = Sale Price × Quantity × Tax Rate
 *   Net Proceeds = Sale Price × Quantity − Tax
 */
export function calculateSaleProceeds(unitPrice: number, quantity: number, taxRate: number): SaleProceeds {
  assertWholeCoins(unitPrice, "Sale price", { min: 1 });
  assertQuantity(quantity);
  const units = saleProceedsUnits(unitPrice, quantity, taxRate);
  return {
    grossProceeds: unitsToCoins(units.gross),
    tax: unitsToCoins(units.tax),
    netProceeds: unitsToCoins(units.net),
  };
}

export interface SaleResult extends SaleProceeds {
  /** Purchase price × quantity. */
  acquisitionCost: number;
  /** Net proceeds − acquisition cost. */
  netProfit: number;
  /** Net profit ÷ acquisition cost × 100. Null when the cards cost nothing (e.g. pack pulls). */
  roiPercent: number | null;
}

export interface SaleInput {
  unitPrice: number;
  unitCost: number;
  quantity: number;
  taxRate: number;
}

/**
 * Full profit calculation for a sale.
 *
 *   Total Acquisition Cost = Purchase Price × Quantity
 *   Total Net Proceeds     = Sale Price × Quantity × (1 − Tax Rate)
 *   Net Profit             = Total Net Proceeds − Total Acquisition Cost
 *   ROI                    = Net Profit ÷ Total Acquisition Cost × 100
 */
export function calculateSale({ unitPrice, unitCost, quantity, taxRate }: SaleInput): SaleResult {
  assertWholeCoins(unitPrice, "Sale price", { min: 1 });
  assertWholeCoins(unitCost, "Purchase price");
  assertQuantity(quantity);
  const proceeds = saleProceedsUnits(unitPrice, quantity, taxRate);
  const costUnits = unitCost * quantity * BPS_SCALE;
  const profitUnits = proceeds.net - costUnits;
  return {
    grossProceeds: unitsToCoins(proceeds.gross),
    tax: unitsToCoins(proceeds.tax),
    netProceeds: unitsToCoins(proceeds.net),
    acquisitionCost: unitsToCoins(costUnits),
    netProfit: unitsToCoins(profitUnits),
    roiPercent: percentOf(profitUnits, costUnits),
  };
}

/**
 * The lowest whole-coin sale price at which selling does not lose money after tax:
 * the smallest P such that P × (1 − taxRate) ≥ unitCost.
 */
export function breakEvenSalePrice(unitCost: number, taxRate: number): number {
  assertWholeCoins(unitCost, "Purchase price");
  const bps = toBps(taxRate);
  return ceilDiv(unitCost * BPS_SCALE, BPS_SCALE - bps);
}

/**
 * Break-even price for a position whose average cost may be fractional
 * (total cost spread over several copies bought at different prices).
 */
export function breakEvenSalePriceForPosition(totalCost: number, quantity: number, taxRate: number): number {
  assertWholeCoins(totalCost, "Total cost");
  assertQuantity(quantity);
  const bps = toBps(taxRate);
  return ceilDiv(totalCost * BPS_SCALE, quantity * (BPS_SCALE - bps));
}

/** Net profit per card if sold at `targetPrice` — used for watchlist targets. */
export function profitAtPrice(unitCost: number, targetPrice: number, taxRate: number): SaleResult {
  if (targetPrice < 1) {
    throw new FinanceInputError("Target price must be at least 1 coin.");
  }
  return calculateSale({ unitPrice: targetPrice, unitCost, quantity: 1, taxRate });
}
