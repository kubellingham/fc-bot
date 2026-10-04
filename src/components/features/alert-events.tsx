"use client";

import { useTransition } from "react";
import { BellRing, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { DateTime } from "@/components/app/money";
import { Button } from "@/components/ui/button";
import { markAlertEventsRead } from "@/lib/actions/alerts";
import type { AlertEvent } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const r = await markAlertEventsRead({});
          if (r && !r.ok) toast.error(r.error);
        })
      }
    >
      <CheckCheck />
      Mark all read
    </Button>
  );
}

export function AlertEventsList({ events, compact = false }: { events: AlertEvent[]; compact?: boolean }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No alerts have fired yet. They&apos;re checked each time you record a price.</p>;
  }
  return (
    <ul className="grid gap-1.5">
      {events.map((e) => (
        <li
          key={e.id}
          className={cn("flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm", !e.readAt && "bg-primary/5")}
        >
          <BellRing className={cn("mt-0.5 size-4 shrink-0", e.readAt ? "text-muted-foreground" : "text-primary")} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className={cn(compact && "truncate")}>{e.message}</p>
            <p className="text-xs text-muted-foreground">
              <DateTime iso={e.triggeredAt} relative />
              {!e.readAt && <span className="ml-2 font-medium text-primary">New</span>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
