"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Field, FormError } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPlayer, updatePlayer } from "@/lib/actions/players";
import type { Player } from "@/lib/domain";
import { POSITIONS, playerSchema, type PlayerInput } from "@/lib/validation/schemas";

const NONE = "__none__";

function defaults(p?: Player): PlayerInput {
  return {
    name: p?.name ?? "",
    version: p?.version ?? "",
    rating: p?.rating?.toString() ?? "",
    position: (p?.position as PlayerInput["position"]) ?? "",
    club: p?.club ?? "",
    league: p?.league ?? "",
    nation: p?.nation ?? "",
    rarity: p?.rarity ?? "",
  };
}

export function PlayerDialog({
  player,
  trigger,
  onCreated,
}: {
  player?: Player;
  trigger: React.ReactNode;
  onCreated?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<PlayerInput>({ resolver: zodResolver(playerSchema), defaultValues: defaults(player) });
  const { submit, pending, formError, setFormError } = useActionForm(
    form,
    (values) => (player ? updatePlayer({ id: player.id, values }) : createPlayer(values)),
    {
      onSuccess: (data) => {
        setOpen(false);
        if (data && typeof data === "object" && "id" in data) onCreated?.((data as { id: string }).id);
      },
    },
  );
  const { errors } = form.formState;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset(defaults(player));
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{player ? "Edit player" : "Add player"}</DialogTitle>
          <DialogDescription>Players are stored in your private catalog. Name and version must be unique.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <Field id="player-name" label="Name" required error={errors.name?.message}>
              {(aria) => <Input autoFocus maxLength={80} {...aria} {...form.register("name")} />}
            </Field>
            <Field id="player-rating" label="Rating" error={errors.rating?.message}>
              {(aria) => <Input inputMode="numeric" placeholder="e.g. 91" {...aria} {...form.register("rating")} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="player-version" label="Version" hint='e.g. "TOTW 3", "Icon". Defaults to Base.' error={errors.version?.message}>
              {(aria) => <Input maxLength={40} {...aria} {...form.register("version")} />}
            </Field>
            <Field id="player-position" label="Position" error={errors.position?.message}>
              {(aria) => (
                <Controller
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <Select value={field.value ? String(field.value) : NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger {...aria}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not set</SelectItem>
                        {POSITIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="player-club" label="Club" error={errors.club?.message}>
              {(aria) => <Input maxLength={60} {...aria} {...form.register("club")} />}
            </Field>
            <Field id="player-league" label="League" error={errors.league?.message}>
              {(aria) => <Input maxLength={60} {...aria} {...form.register("league")} />}
            </Field>
            <Field id="player-nation" label="Nation" error={errors.nation?.message}>
              {(aria) => <Input maxLength={60} {...aria} {...form.register("nation")} />}
            </Field>
            <Field id="player-rarity" label="Rarity" hint="e.g. Gold Rare, TOTW, Icon" error={errors.rarity?.message}>
              {(aria) => <Input maxLength={40} {...aria} {...form.register("rarity")} />}
            </Field>
          </div>
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : player ? "Save changes" : "Add player"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
