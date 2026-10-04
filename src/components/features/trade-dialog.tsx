"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { CoinInput } from "@/components/forms/coin-input";
import { DateTimeInput, nowIso } from "@/components/forms/datetime-input";
import { Field, FormError } from "@/components/forms/field";
import { PlayerPicker, type PickerPlayer } from "@/components/forms/player-picker";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createTrade, updateTrade } from "@/lib/actions/trades";
import type { Trade } from "@/lib/domain";
import { tradeSchema, tradeUpdateSchema, type TradeInput } from "@/lib/validation/schemas";
import { ProfitPreview } from "./profit-preview";

function defaults(trade?: Trade, playerId?: string): TradeInput {
  return {
    playerId: trade?.playerId ?? playerId ?? "",
    quantity: trade?.quantity?.toString() ?? "1",
    unitCost: trade?.unitCost?.toString() ?? "",
    acquiredAt: trade?.acquiredAt ?? nowIso(),
    notes: trade?.notes ?? "",
    sold: false,
    salePrice: "",
    soldAt: "",
  };
}

/** Record a purchase (optionally already sold), or edit an existing purchase. */
export function TradeDialog({
  players,
  taxRate,
  trade,
  defaultPlayerId,
  trigger,
}: {
  players: PickerPlayer[];
  taxRate: number;
  trade?: Trade;
  defaultPlayerId?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const editing = Boolean(trade);
  const form = useForm<TradeInput>({
    // Editing uses the narrower update schema (no sale fields).
    resolver: zodResolver(editing ? (tradeUpdateSchema.omit({ id: true }) as unknown as typeof tradeSchema) : tradeSchema),
    defaultValues: defaults(trade, defaultPlayerId),
  });
  const { submit, pending, formError, setFormError } = useActionForm(
    form,
    (v) =>
      trade
        ? updateTrade({ id: trade.id, playerId: v.playerId, quantity: v.quantity, unitCost: v.unitCost, acquiredAt: v.acquiredAt, notes: v.notes })
        : createTrade(v),
    { onSuccess: () => setOpen(false) },
  );
  const { errors } = form.formState;
  const [sold, quantity, unitCost, salePrice] = useWatch({ control: form.control, name: ["sold", "quantity", "unitCost", "salePrice"] });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset(defaults(trade, defaultPlayerId));
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit purchase" : "Record a purchase"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changes apply to this purchase and its profit calculations."
              : "Log a card you bought in game. Prices are per card."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field id="trade-player" label="Player" required error={errors.playerId?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="playerId"
                render={({ field }) => <PlayerPicker {...aria} players={players} value={field.value} onChange={field.onChange} />}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
            <Field id="trade-qty" label="Quantity" required error={errors.quantity?.message}>
              {(aria) => <Input inputMode="numeric" {...aria} {...form.register("quantity")} />}
            </Field>
            <Field id="trade-cost" label="Purchase price (each)" required hint="Use 0 for pack pulls or rewards." error={errors.unitCost?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="unitCost"
                  render={({ field }) => <CoinInput {...aria} {...field} value={field.value as string} />}
                />
              )}
            </Field>
          </div>
          <Field id="trade-date" label="Purchased at" required hint="Your local time." error={errors.acquiredAt?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="acquiredAt"
                render={({ field }) => <DateTimeInput {...aria} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
              />
            )}
          </Field>
          <Field id="trade-notes" label="Notes" error={errors.notes?.message}>
            {(aria) => <Textarea rows={2} maxLength={1000} {...aria} {...form.register("notes")} />}
          </Field>

          {!editing && (
            <div className="grid gap-4 rounded-lg border p-3">
              <label className="flex items-center justify-between gap-3 text-sm font-medium">
                Already sold?
                <Controller
                  control={form.control}
                  name="sold"
                  render={({ field }) => <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} aria-label="Already sold" />}
                />
              </label>
              {sold && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="trade-sale-price" label="Sale price (each)" required error={errors.salePrice?.message}>
                      {(aria) => (
                        <Controller
                          control={form.control}
                          name="salePrice"
                          render={({ field }) => <CoinInput {...aria} {...field} value={field.value as string} />}
                        />
                      )}
                    </Field>
                    <Field id="trade-sold-at" label="Sold at" required error={errors.soldAt?.message}>
                      {(aria) => (
                        <Controller
                          control={form.control}
                          name="soldAt"
                          render={({ field }) => (
                            <DateTimeInput {...aria} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
                          )}
                        />
                      )}
                    </Field>
                  </div>
                  <ProfitPreview unitCost={unitCost} unitPrice={salePrice} quantity={quantity} taxRate={taxRate} />
                </>
              )}
            </div>
          )}

          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Record purchase"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
