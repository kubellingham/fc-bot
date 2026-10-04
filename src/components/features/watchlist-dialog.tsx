"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CoinInput } from "@/components/forms/coin-input";
import { Field, FormError } from "@/components/forms/field";
import { PlayerPicker, type PickerPlayer } from "@/components/forms/player-picker";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { saveWatchlistItem } from "@/lib/actions/watchlist";
import type { WatchlistItem } from "@/lib/domain";
import { watchlistSchema, type WatchlistInput } from "@/lib/validation/schemas";

export function WatchlistDialog({
  players,
  item,
  defaultPlayerId,
  trigger,
}: {
  players: PickerPlayer[];
  item?: WatchlistItem;
  defaultPlayerId?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const makeDefaults = (): WatchlistInput => ({
    playerId: item?.playerId ?? defaultPlayerId ?? "",
    targetBuyPrice: item?.targetBuyPrice?.toString() ?? "",
    targetSellPrice: item?.targetSellPrice?.toString() ?? "",
    notes: item?.notes ?? "",
  });
  const form = useForm<WatchlistInput>({ resolver: zodResolver(watchlistSchema), defaultValues: makeDefaults() });
  const { submit, pending, formError, setFormError } = useActionForm(form, saveWatchlistItem, { onSuccess: () => setOpen(false) });
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
          <DialogTitle>{item ? "Edit watchlist targets" : "Add to watchlist"}</DialogTitle>
          <DialogDescription>
            Targets are flagged when a price you record reaches them. To be notified, create an alert.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field id="watch-player" label="Player" required error={errors.playerId?.message}>
            {(aria) => (
              <Controller
                control={form.control}
                name="playerId"
                render={({ field }) => (
                  <PlayerPicker {...aria} players={players} value={field.value} onChange={field.onChange} disabled={Boolean(item)} />
                )}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="watch-buy" label="Target buy price" hint="Buy at or below." error={errors.targetBuyPrice?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="targetBuyPrice"
                  render={({ field }) => <CoinInput {...aria} {...field} value={field.value as string} />}
                />
              )}
            </Field>
            <Field id="watch-sell" label="Target sell price" hint="Sell at or above." error={errors.targetSellPrice?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="targetSellPrice"
                  render={({ field }) => <CoinInput {...aria} {...field} value={field.value as string} />}
                />
              )}
            </Field>
          </div>
          <Field id="watch-notes" label="Notes" error={errors.notes?.message}>
            {(aria) => <Input maxLength={500} {...aria} {...form.register("notes")} />}
          </Field>
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : item ? "Save targets" : "Add to watchlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
