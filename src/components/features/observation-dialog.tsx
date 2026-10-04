"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { CoinInput } from "@/components/forms/coin-input";
import { DateTimeInput, nowIso } from "@/components/forms/datetime-input";
import { Field, FormError } from "@/components/forms/field";
import { PlayerPicker, type PickerPlayer } from "@/components/forms/player-picker";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { recordObservation } from "@/lib/actions/prices";
import { observationSchema, type ObservationInput } from "@/lib/validation/schemas";

/** Log a price seen on the Transfer Market. Prices never update automatically. */
export function ObservationDialog({
  players,
  defaultPlayerId,
  trigger,
}: {
  players: PickerPlayer[];
  defaultPlayerId?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const makeDefaults = (): ObservationInput => ({ playerId: defaultPlayerId ?? "", price: "", observedAt: nowIso(), notes: "" });
  const form = useForm<ObservationInput>({ resolver: zodResolver(observationSchema), defaultValues: makeDefaults() });
  const { submit, pending, formError, setFormError } = useActionForm(form, recordObservation, {
    onSuccess: (data) => {
      setOpen(false);
      for (const message of data?.triggered ?? []) toast.info("Alert triggered", { description: message });
    },
  });
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
          <DialogTitle>Record a price</DialogTitle>
          <DialogDescription>
            Enter a price you saw on the Transfer Market (e.g. the lowest Buy Now). Your alerts are checked against it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field id="obs-player" label="Player" required error={errors.playerId?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="playerId"
                render={({ field }) => <PlayerPicker {...aria} players={players} value={field.value} onChange={field.onChange} />}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="obs-price" label="Price" required error={errors.price?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="price"
                  render={({ field }) => <CoinInput {...aria} {...field} value={field.value as string} />}
                />
              )}
            </Field>
            <Field id="obs-date" label="Seen at" required error={errors.observedAt?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="observedAt"
                  render={({ field }) => <DateTimeInput {...aria} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
                />
              )}
            </Field>
          </div>
          <Field id="obs-notes" label="Notes" hint="Optional — e.g. platform or market conditions." error={errors.notes?.message}>
            {(aria) => <Input maxLength={500} {...aria} {...form.register("notes")} />}
          </Field>
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Record price"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
