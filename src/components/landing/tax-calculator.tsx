"use client";

import { useId, useState } from "react";
import { Delta } from "@/components/app/money";
import { useFormatter } from "@/components/format-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { breakEvenSalePrice, calculateSale, DEFAULT_TAX_RATE } from "@/lib/finance";
import { parseCoinInput } from "@/lib/validation/coins";

/** A working calculator powered by the same finance module the app uses. */
export function TaxCalculator() {
  const f = useFormatter();
  const id = useId();
  const [buy, setBuy] = useState("10,000");
  const [sell, setSell] = useState("12,000");
  const [qty, setQty] = useState("1");

  const buyN = parseCoinInput(buy);
  const sellN = parseCoinInput(sell);
  const qtyN = Number(qty);
  let result: ReturnType<typeof calculateSale> | null = null;
  try {
    if (buyN !== null && sellN !== null && sellN >= 1) {
      result = calculateSale({ unitCost: buyN, unitPrice: sellN, quantity: qtyN, taxRate: DEFAULT_TAX_RATE });
    }
  } catch {
    result = null;
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">Profit after the 5% EA tax</h3>
        <span className="text-xs text-muted-foreground">Try it</span>
      </div>
      <div className="grid grid-cols-[1fr_1fr_4.5rem] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-buy`}>Buy price</Label>
          <Input id={`${id}-buy`} inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-sell`}>Sell price</Label>
          <Input id={`${id}-sell`} inputMode="decimal" value={sell} onChange={(e) => setSell(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-qty`}>Qty</Label>
          <Input id={`${id}-qty`} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
      </div>
      {result ? (
        <dl className="grid grid-cols-2 gap-y-1.5 text-sm tabular" aria-live="polite">
          <dt className="text-muted-foreground">Tax paid</dt>
          <dd className="text-right">{f.coins(result.tax)}</dd>
          <dt className="text-muted-foreground">You receive</dt>
          <dd className="text-right">{f.coins(result.netProceeds)}</dd>
          <dt className="text-muted-foreground">Break-even sell price</dt>
          <dd className="text-right">{buyN !== null ? f.coins(breakEvenSalePrice(buyN, DEFAULT_TAX_RATE)) : "—"}</dd>
          <dt className="font-medium">Net profit</dt>
          <dd className="text-right font-medium">
            <Delta value={result.netProfit} percent={result.roiPercent} />
          </dd>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">Enter whole-coin prices (e.g. 12500 or 12.5k) and a quantity from 1 to 10,000.</p>
      )}
    </div>
  );
}
