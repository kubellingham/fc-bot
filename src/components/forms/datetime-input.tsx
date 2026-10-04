"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in the browser's local time. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (browser local time) → ISO timestamp with offset, or "" if invalid. */
export function localInputToIso(local: string): string {
  if (!local) return "";
  const d = new Date(local); // date-time strings without an offset are parsed as local time
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Current time, kept to the second so entries made in quick succession stay in order. */
export function nowIso(): string {
  const d = new Date();
  d.setMilliseconds(0);
  return d.toISOString();
}

/**
 * Date-time picker whose value is an ISO timestamp. The browser control works in
 * local time; conversion happens here so the server always receives an explicit
 * instant and never has to guess the user's time zone.
 */
export const DateTimeInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
    value: string | null | undefined;
    onChange: (iso: string) => void;
  }
>(function DateTimeInput({ value, onChange, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="datetime-local"
      max={isoToLocalInput(new Date(Date.now() + 60_000).toISOString())}
      value={isoToLocalInput(value)}
      onChange={(e) => onChange(localInputToIso(e.target.value))}
      {...props}
    />
  );
});
