"use client";

import { useState, useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Submits raw form values to a Server Action (which re-validates them), maps
 * server field errors back onto the form, and reports the outcome.
 */
export function useActionForm<V extends FieldValues, T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts forms with any resolver output type
  form: UseFormReturn<V, any, any>,
  action: (values: V) => Promise<ActionResult<T>>,
  { onSuccess }: { onSuccess?: (data: T, message?: string) => void } = {},
) {
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = form.handleSubmit(() => {
    setFormError(null);
    const values = form.getValues();
    startTransition(async () => {
      let result: ActionResult<T>;
      try {
        result = await action(values);
      } catch {
        // Network failure or an unexpected server error: the action never returned.
        setFormError("We couldn't reach the server. Check your connection and try again.");
        return;
      }
      // A Server Action that redirects resolves without a result while the router navigates.
      if (!result) return;
      if (result.ok) {
        if (result.message) toast.success(result.message);
        onSuccess?.(result.data, result.message);
        return;
      }
      if (result.fieldErrors) {
        for (const [name, message] of Object.entries(result.fieldErrors)) {
          if (name in values) form.setError(name as Path<V>, { type: "server", message });
        }
      }
      setFormError(result.error);
    });
  });

  return { submit, pending, formError, setFormError };
}
