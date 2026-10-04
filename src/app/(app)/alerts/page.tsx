import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { AlertFormDialog } from "@/components/features/alert-dialog";
import { AlertEventsList, MarkAllReadButton } from "@/components/features/alert-events";
import { AlertsList } from "@/components/features/alerts-list";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { alertRows } from "@/lib/data/alert-views";
import { getAlertEvents, getAlerts, getObservations, getPlayerMap, getPlayers, getSettings } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const [alerts, events, players, playerMap, settings] = await Promise.all([
    getAlerts(),
    getAlertEvents(100),
    getPlayers(),
    getPlayerMap(),
    getSettings(),
  ]);
  const observations = await getObservations({ playerIds: [...new Set(alerts.map((a) => a.playerId))] });
  const rows = alertRows(alerts, playerMap, observations);
  const unread = events.filter((e) => !e.readAt).length;

  const createButton =
    players.length > 0 ? (
      <AlertFormDialog players={players} trigger={<Button size="sm"><Plus />New alert</Button>} />
    ) : (
      <Button asChild size="sm">
        <Link href="/players">Add a player first</Link>
      </Button>
    );

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Alerts"
        description="Alerts are evaluated against the prices you record and notify you here. They never place trades."
        actions={players.length > 0 ? createButton : undefined}
      />
      {!settings.alertNotifications && (
        <p className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
          The unread badge is turned off in <Link href="/settings" className="underline">Settings</Link>. Alerts still fire and appear below.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="alert-rules" className="grid content-start gap-3">
          <h2 id="alert-rules" className="text-sm font-medium">
            Your alerts ({rows.length})
          </h2>
          {rows.length === 0 ? (
            <EmptyState
              icon={<Bell />}
              title="No alerts yet"
              description="Get notified when a price you record falls below or rises above a target, or moves by a percentage."
              action={createButton}
            />
          ) : (
            <AlertsList rows={rows} />
          )}
        </section>
        <Card className="content-start">
          <CardHeader>
            <CardTitle className="text-sm">Notifications</CardTitle>
            <CardDescription className="text-xs">{unread ? `${unread} unread` : "All caught up"}</CardDescription>
            <CardAction>
              <MarkAllReadButton disabled={unread === 0} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <AlertEventsList events={events} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
