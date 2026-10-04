"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown when a page fails to load. Never displays internal error details. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 py-16 text-center" role="alert">
      <AlertTriangle className="size-8 text-warning" aria-hidden="true" />
      <div className="grid gap-1">
        <h1 className="text-lg font-semibold">This page couldn&apos;t load</h1>
        <p className="text-sm text-muted-foreground">
          Your data is safe. This is usually temporary — please try again.
          {error.digest && <span className="mt-2 block text-xs">Reference: {error.digest}</span>}
        </p>
      </div>
      <Button onClick={reset}>
        <RotateCcw />
        Try again
      </Button>
    </div>
  );
}
