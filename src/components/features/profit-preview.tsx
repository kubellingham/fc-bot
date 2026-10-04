"use client";

import { Delta } from "@/components/app/money";
import { useFormatter } from "@/components/format-provider";
import { breakEvenSalePrice, calculateSale, positionProfitAtPrice } from "@/lib/finance";
import { parseCoinInput } from "@/lib/validation/coins";

function toCoins(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) ? v : null;
  if (typeof v === "string") return parseCoinInput(v);
  return null;
}

function toQty(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : null;
}

/**
 * Live breakdown of a sale using the shared finance module, so the preview
 * is exactly what the trade journal will show after saving.
 */
export function ProfitPreview({
  unitCost,
  totalCost,
  unitPrice,
  quantity,
  taxRate,
}: {
  unitCost?: unknown;
  /** Exact cost basis (e.g. from a FIFO allocation) — overrides unitCost × quantity. */
  totalCost?: number | null;
  unitPrice: unknown;
  quantity: unknown;
  taxRate: number;
}) {
  const f = useFormatter();
  const qty = toQty(quantity);
  const price = toCoins(unitPrice);
  const cost = toCoins(unitCost);
  if (qty === null || price === null || price < 1 || ((totalCost === undefined || totalCost === null) && cost === null)) {
    return (
      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Enter quantity and prices to see tax, net proceeds and profit.
      </p>
    );
  }
  let result;
  try {
    result =
      totalCost !== undefined && totalCost !== null
        ? positionProfitAtPrice(totalCost, qty, price, taxRate)
        : calculateSale({ unitPrice: price, unitCost: cost!, quantity: qty, taxRate });
  } catch {
    return null;
  }
  const rows: [string, React.ReactNode][] = [
    ["Gross sale", f.coins(result.grossProceeds)],
    [`EA tax (${f.number(taxRate * 100, taxRate * 100 % 1 === 0 ? 0 : 2)}%)`, `−${f.coins(result.tax)}`],
    ["Net proceeds", f.coins(result.netProceeds)],
    ["Cost", f.coins(result.acquisitionCost)],
  ];
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm" aria-live="polite">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 tabular">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
        <dt className="font-medium">Net profit</dt>
        <dd className="text-right font-medium">
          <Delta value={result.netProfit} percent={result.roiPercent} />
        </dd>
      </dl>
      {cost !== null && totalCost === undefined && (
        <p className="mt-2 text-xs text-muted-foreground">Break-even sale price: {f.coins(breakEvenSalePrice(cost, taxRate))} per card.</p>
      )}
    </div>
  );
}
