"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useFormatter } from "@/components/format-provider";
import { CoinInput } from "@/components/forms/coin-input";
import { DateTimeInput, nowIso } from "@/components/forms/datetime-input";
import { Field, FormError } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addAdjustment, reconcileBalance } from "@/lib/actions/coins";
import { adjustmentSchema, reconcileSchema, type AdjustmentInput } from "@/lib/validation/schemas";
import type { z } from "zod";

export function AdjustmentDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const makeDefaults = (): AdjustmentInput => ({ direction: "credit", amount: "", reason: "", occurredAt: nowIso() });
  const form = useForm<AdjustmentInput>({ resolver: zodResolver(adjustmentSchema), defaultValues: makeDefaults() });
  const { submit, pending, formError, setFormError } = useActionForm(form, addAdjustment, { onSuccess: () => setOpen(false) });
  const { errors } = form.formState;
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
          <DialogTitle>Record a coin adjustment</DialogTitle>
          <DialogDescription>Coins earned or spent outside trading — objectives, rewards, packs, SBCs.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <Field id="adj-direction" label="Type">
              {(aria) => (
                <Controller
                  control={form.control}
                  name="direction"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Coins in</SelectItem>
                        <SelectItem value="debit">Coins out</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
            <Field id="adj-amount" label="Amount" required error={errors.amount?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="amount"
                  render={({ field }) => <CoinInput {...aria} {...field} value={field.value as string} />}
                />
              )}
            </Field>
          </div>
          <Field id="adj-reason" label="Reason" required error={errors.reason?.message}>
            {(aria) => <Input maxLength={200} placeholder="e.g. Weekly objectives" {...aria} {...form.register("reason")} />}
          </Field>
          <Field id="adj-date" label="When" required error={errors.occurredAt?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="occurredAt"
                render={({ field }) => <DateTimeInput {...aria} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
              />
            )}
          </Field>
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReconcileDialog({ trackedBalance, trigger }: { trackedBalance: number; trigger: React.ReactNode }) {
  const f = useFormatter();
  const [open, setOpen] = useState(false);
  const form = useForm<z.input<typeof reconcileSchema>>({ resolver: zodResolver(reconcileSchema), defaultValues: { actualBalance: "" } });
  const { submit, pending, formError, setFormError } = useActionForm(form, reconcileBalance, {
    onSuccess: (data) => {
      setOpen(false);
      toast.success(
        data.difference === 0
          ? "Your tracked balance already matches."
          : `Recorded an adjustment of ${f.signedCoins(data.difference)} coins.`,
      );
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset({ actualBalance: "" });
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync with your in-game balance</DialogTitle>
          <DialogDescription>
            Tracked available coins: <span className="font-medium text-foreground tabular">{f.coins(trackedBalance)}</span>. Enter
            the balance shown in game and we&apos;ll record the difference as an adjustment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field id="rec-balance" label="In-game coin balance" required error={form.formState.errors.actualBalance?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="actualBalance"
                render={({ field }) => <CoinInput autoFocus {...aria} {...field} value={field.value as string} />}
              />
            )}
          </Field>
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Sync balance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
