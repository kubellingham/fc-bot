"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { useFormatter } from "@/components/format-provider";
import { parseCoinInput } from "@/lib/validation/coins";

/**
 * Text input for coin amounts. Accepts "12500", "12,500", "12.5k" or "1.2m" and
 * shows the interpreted value so shorthand is never ambiguous.
 */
export const CoinInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input> & { value?: string | number | null }>(
  function CoinInput({ value, ...props }, ref) {
    const f = useFormatter();
    const text = value === null || value === undefined ? "" : String(value);
    const parsed = text.trim() === "" ? null : parseCoinInput(text);
    const showPreview = parsed !== null && /[kKmM.,\s]/.test(text);
    return (
      <div className="relative">
        <Input
          ref={ref}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. 12500 or 12.5k"
          value={text}
          {...props}
          className="pr-24"
        />
        {showPreview && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground tabular" aria-live="polite">
            = {f.coins(parsed)}
          </span>
        )}
      </div>
    );
  },
);
