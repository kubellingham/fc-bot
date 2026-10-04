"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { LocateFixed } from "lucide-react";
import { CoinInput } from "@/components/forms/coin-input";
import { Field, FormError } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateSettings } from "@/lib/actions/settings";
import type { Settings } from "@/lib/domain";
import { createFormatter } from "@/lib/format";
import { NUMBER_LOCALES, settingsSchema, type SettingsInput } from "@/lib/validation/schemas";

const LOCALE_LABELS: Record<(typeof NUMBER_LOCALES)[number], string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "de-DE": "Deutsch",
  "fr-FR": "Français",
  "es-ES": "Español",
  "it-IT": "Italiano",
  "nl-NL": "Nederlands",
  "pt-BR": "Português (BR)",
};

function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const { setTheme } = useTheme();
  const zones = useMemo(() => timeZones(), []);
  const defaults: SettingsInput = {
    displayName: settings.displayName ?? "",
    startingCoinBalance: String(settings.startingCoinBalance),
    taxRatePercent: String(Math.round(settings.taxRate * 10_000) / 100),
    numberLocale: settings.numberLocale as SettingsInput["numberLocale"],
    compactNumbers: settings.compactNumbers,
    theme: settings.theme,
    timezone: settings.timezone,
    alertNotifications: settings.alertNotifications,
  };
  const form = useForm({ resolver: zodResolver(settingsSchema), defaultValues: defaults });
  const { submit, pending, formError } = useActionForm(form, updateSettings, {
    onSuccess: () => {
      setTheme(form.getValues("theme"));
      form.reset(form.getValues());
    },
  });
  const { errors, isDirty } = form.formState;
  const [locale, compact, tz] = useWatch({ control: form.control, name: ["numberLocale", "compactNumbers", "timezone"] });
  const sample = createFormatter({ locale, compact, timeZone: tz || "UTC" });
  const browserZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:max-w-md">
          <Field id="set-name" label="Display name" error={errors.displayName?.message}>
            {(aria) => <Input maxLength={60} autoComplete="nickname" {...aria} {...form.register("displayName")} />}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Coins & tax</CardTitle>
          <CardDescription className="text-xs">These drive every balance and profit calculation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            id="set-balance"
            label="Starting coin balance"
            hint="Coins you had before the first trade you record. Use “Sync with game” on Portfolio to correct drift."
            error={errors.startingCoinBalance?.message}
          >
            {(aria) => (
              <Controller
                control={form.control}
                name="startingCoinBalance"
                render={({ field }) => <CoinInput {...aria} {...field} value={field.value as string} />}
              />
            )}
          </Field>
          <Field
            id="set-tax"
            label="Transfer tax rate (%)"
            hint="EA's tax is 5%. Applies to new sales; past sales keep the rate they were recorded with."
            error={errors.taxRatePercent?.message}
          >
            {(aria) => <Input inputMode="decimal" {...aria} {...form.register("taxRatePercent")} />}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Display</CardTitle>
          <CardDescription className="text-xs">
            Preview: {sample.coins(1234567)} coins · {sample.coins(1234567, { compact: true })} compact · {sample.dateTime(new Date().toISOString())}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="set-locale" label="Number & date format">
            {(aria) => (
              <Controller
                control={form.control}
                name="numberLocale"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...aria}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NUMBER_LOCALES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {LOCALE_LABELS[l]} — {createFormatter({ locale: l, compact: false, timeZone: "UTC" }).coins(1234567)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
          <Field id="set-theme" label="Theme">
            {(aria) => (
              <Controller
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...aria}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="system">Match system</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
          <Field id="set-tz" label="Time zone" hint="Used for daily, weekly and monthly buckets." error={errors.timezone?.message}>
            {(aria) => (
              <div className="flex gap-2">
                <select
                  {...aria}
                  {...form.register("timezone")}
                  className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {zones.map((z) => (
                    <option key={z} value={z} className="bg-popover">
                      {z}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={`Use this device's time zone (${browserZone})`}
                  aria-label={`Use this device's time zone (${browserZone})`}
                  onClick={() => form.setValue("timezone", browserZone, { shouldDirty: true, shouldValidate: true })}
                >
                  <LocateFixed />
                </Button>
              </div>
            )}
          </Field>
          <div className="grid content-start gap-4 pt-1">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Compact large numbers
                <span className="block text-xs text-muted-foreground">Show 1.2M instead of 1,234,567 where enabled</span>
              </span>
              <Controller
                control={form.control}
                name="compactNumbers"
                render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Compact large numbers" />}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notifications</CardTitle>
          <CardDescription className="text-xs">
            Alerts appear in the app when you record a price that meets a condition. Email and push delivery are not available yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex max-w-md items-center justify-between gap-3 text-sm">
            <span>
              Show unread alert badge
              <span className="block text-xs text-muted-foreground">In the navigation and on the dashboard</span>
            </span>
            <Controller
              control={form.control}
              name="alertNotifications"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Show unread alert badge" />}
            />
          </label>
        </CardContent>
      </Card>

      <FormError message={formError} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {isDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
    </form>
  );
}
