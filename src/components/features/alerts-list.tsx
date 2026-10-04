"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Bell, BellOff, CheckCircle2, CircleDashed, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DateTime } from "@/components/app/money";
import { useFormatter } from "@/components/format-provider";
import { ConfirmAction } from "@/components/features/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { deleteAlert, setAlertActive } from "@/lib/actions/alerts";
import type { AlertRow } from "@/lib/data/alert-views";
import { describeAlertRule } from "@/lib/finance/alerts";

function ActiveToggle({ alert }: { alert: AlertRow }) {
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={alert.isActive}
      disabled={pending}
      aria-label={alert.isActive ? `Pause alert for ${alert.label}` : `Resume alert for ${alert.label}`}
      onCheckedChange={(active) =>
        start(async () => {
          const r = await setAlertActive({ id: alert.id, active });
          if (r && !r.ok) toast.error(r.error);
        })
      }
    />
  );
}

export function AlertsList({ rows, showPlayer = true }: { rows: AlertRow[]; showPlayer?: boolean }) {
  const f = useFormatter();
  return (
    <ul className="grid gap-2">
      {rows.map((a) => {
        const rule = describeAlertRule(
          { type: a.type, targetValue: a.targetValue, lookbackHours: a.lookbackHours, direction: a.direction },
          (n) => f.coins(n),
        );
        return (
          <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
            {a.isActive ? (
              <Bell className="size-4 text-primary" aria-hidden="true" />
            ) : (
              <BellOff className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              {showPlayer && (
                <Link href={`/players/${a.playerId}`} className="font-medium hover:underline">
                  {a.label}
                </Link>
              )}
              <p className={showPlayer ? "text-muted-foreground" : "font-medium"}>{rule}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {a.status === "satisfied" && (
                  <span className="inline-flex items-center gap-1 text-gain">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Condition met
                  </span>
                )}
                {a.status === "not_satisfied" && (
                  <span className="inline-flex items-center gap-1">
                    <CircleDashed className="size-3" aria-hidden="true" />
                    Not met
                  </span>
                )}
                {a.status === "insufficient_data" && <span>{a.reason}</span>}
                {a.latestPrice !== null && (
                  <span>
                    · latest {f.coins(a.latestPrice)}
                    {a.changePercent !== null && ` (${f.signedPercent(a.changePercent)})`}
                  </span>
                )}
                {a.lastTriggeredAt && (
                  <span>
                    · last fired <DateTime iso={a.lastTriggeredAt} relative />
                  </span>
                )}
              </p>
              {a.note && <p className="mt-0.5 text-xs text-muted-foreground italic">{a.note}</p>}
            </div>
            {!a.isActive && <Badge variant="outline">Paused</Badge>}
            <ActiveToggle alert={a} />
            <ConfirmAction
              title="Delete alert?"
              description="Its notification history will be deleted too."
              onConfirm={() => deleteAlert({ id: a.id })}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Delete alert: ${rule}`}>
                  <Trash2 />
                </Button>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
