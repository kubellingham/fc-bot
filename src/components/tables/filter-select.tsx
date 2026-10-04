"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ALL = "__all__";

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  // Explicit label so the trigger is correct on first render (Radix otherwise fills it in after mount).
  const current = value === ALL ? allLabel : (options.find((o) => o.value === value)?.label ?? allLabel);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-full sm:w-40" aria-label={label}>
        <SelectValue>{current}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function distinctOptions(values: (string | null | undefined)[]): { value: string; label: string }[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
}
