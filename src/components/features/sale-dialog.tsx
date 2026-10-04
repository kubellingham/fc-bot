"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { CoinInput } from "@/components/forms/coin-input";
import { DateTimeInput, nowIso } from "@/components/forms/datetime-input";
import { Field, FormError } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { recordSale } from "@/lib/actions/trades";
import { allocateFifo } from "@/lib/finance";
import { saleSchema, type SaleInput } from "@/lib/validation/schemas";
import { ProfitPreview } from "./profit-preview";

export interface OpenLot {
  id: string;
  remainingQuantity: number;
  unitCost: number;
  acquiredAt: string;
}

/**
 * Record a sale. For a holding (several purchases of one player) copies are
 * taken oldest-first; the preview runs the same FIFO allocation as the server.
 */
export function SaleDialog({
  target,
  lots,
  taxRate,
  playerName,
  defaultPrice,
  trigger,
}: {
  target: { tradeId: string } | { playerId: string };
  lots: OpenLot[];
  taxRate: number;
  playerName: string;
  defaultPrice?: number | null;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const available = lots.reduce((s, l) => s + l.remainingQuantity, 0);
  const makeDefaults = (): SaleInput => ({
    ...target,
    quantity: String(Math.min(1, available) || 1),
    unitPrice: defaultPrice ? String(defaultPrice) : "",
    soldAt: nowIso(),
    notes: "",
  });
  const form = useForm<SaleInput>({ resolver: zodResolver(saleSchema), defaultValues: makeDefaults() });
  const { submit, pending, formError, setFormError } = useActionForm(form, recordSale, { onSuccess: () => setOpen(false) });
  const { errors } = form.formState;
  const [quantity, unitPrice] = useWatch({ control: form.control, name: ["quantity", "unitPrice"] });

  const costBasis = useMemo(() => {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > available) return null;
    const byId = new Map(lots.map((l) => [l.id, l]));
    const allocations = allocateFifo(lots, qty);
    return allocations.reduce((s, a) => s + a.quantity * byId.get(a.lotId)!.unitCost, 0);
  }, [quantity, lots, available]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset(makeDefaults());
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a sale</DialogTitle>
          <DialogDescription>
            {playerName} · {available} {available === 1 ? "copy" : "copies"} held
            {lots.length > 1 && !("tradeId" in target) ? " · oldest copies are sold first (FIFO)" : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
            <Field id="sale-qty" label="Quantity" required error={errors.quantity?.message}>
              {(aria) => <Input inputMode="numeric" {...aria} {...form.register("quantity")} />}
            </Field>
            <Field id="sale-price" label="Sale price (each)" required error={errors.unitPrice?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="unitPrice"
                  render={({ field }) => <CoinInput autoFocus {...aria} {...field} value={field.value as string} />}
                />
              )}
            </Field>
          </div>
          <Field id="sale-date" label="Sold at" required hint="Your local time." error={errors.soldAt?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="soldAt"
                render={({ field }) => <DateTimeInput {...aria} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
              />
            )}
          </Field>
          <Field id="sale-notes" label="Notes" error={errors.notes?.message}>
            {(aria) => <Textarea rows={2} maxLength={1000} {...aria} {...form.register("notes")} />}
          </Field>
          {costBasis === null && Number(quantity) > available ? (
            <p className="text-xs text-destructive">You hold {available} {available === 1 ? "copy" : "copies"}.</p>
          ) : (
            <ProfitPreview totalCost={costBasis} unitPrice={unitPrice} quantity={quantity} taxRate={taxRate} />
          )}
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || available === 0}>
              {pending ? "Saving…" : "Record sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
