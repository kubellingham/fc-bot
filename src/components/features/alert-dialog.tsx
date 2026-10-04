"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { CoinInput } from "@/components/forms/coin-input";
import { Field, FormError } from "@/components/forms/field";
import { PlayerPicker, type PickerPlayer } from "@/components/forms/player-picker";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAlert } from "@/lib/actions/alerts";
import { alertSchema, LOOKBACK_OPTIONS, type AlertInput } from "@/lib/validation/schemas";

const TYPES = [
  { value: "price_below", label: "Price falls to or below" },
  { value: "price_above", label: "Price rises to or above" },
  { value: "pct_change", label: "Price changes by a percentage" },
] as const;

export function AlertFormDialog({
  players,
  defaultPlayerId,
  trigger,
}: {
  players: PickerPlayer[];
  defaultPlayerId?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const makeDefaults = (): AlertInput => ({
    playerId: defaultPlayerId ?? "",
    alertType: "price_below",
    targetValue: "",
    lookback: "previous",
    direction: "any",
    note: "",
  });
  const form = useForm<AlertInput>({ resolver: zodResolver(alertSchema), defaultValues: makeDefaults() });
  const { submit, pending, formError, setFormError } = useActionForm(form, createAlert, {
    onSuccess: (data) => {
      setOpen(false);
      for (const message of data?.triggered ?? []) toast.info("Alert condition already met", { description: message });
    },
  });
  const { errors } = form.formState;
  const type = useWatch({ control: form.control, name: "alertType" });
  const isPct = type === "pct_change";

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
          <DialogTitle>Create a price alert</DialogTitle>
          <DialogDescription>
            Alerts are checked whenever you record a price for this player. They notify you in the app — they never trade.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field id="alert-player" label="Player" required error={errors.playerId?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="playerId"
                render={({ field }) => <PlayerPicker {...aria} players={players} value={field.value} onChange={field.onChange} />}
              />
            )}
          </Field>
          <Field id="alert-type" label="Condition" required error={errors.alertType?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="alertType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("targetValue", ""); }}>
                    <SelectTrigger {...aria}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
          <Field
            id="alert-target"
            label={isPct ? "Change threshold (%)" : "Target price"}
            required
            error={errors.targetValue?.message}
          >
            {(aria) =>
              isPct ? (
                <Input inputMode="decimal" placeholder="e.g. 10" {...aria} {...form.register("targetValue")} />
              ) : (
                <Controller
                  control={form.control}
                  name="targetValue"
                  render={({ field }) => <CoinInput {...aria} {...field} value={field.value as string} />}
                />
              )
            }
          </Field>
          {isPct && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="alert-direction" label="Direction">
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
                          <SelectItem value="any">Either direction</SelectItem>
                          <SelectItem value="up">Rises</SelectItem>
                          <SelectItem value="down">Falls</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
              <Field id="alert-lookback" label="Compared with">
                {(aria) => (
                  <Controller
                    control={form.control}
                    name="lookback"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOOKBACK_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
            </div>
          )}
          <Field id="alert-note" label="Note" error={errors.note?.message}>
            {(aria) => <Input maxLength={200} {...aria} {...form.register("note")} />}
          </Field>
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Create alert"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
