"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { PlayerDialog } from "@/components/features/player-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Onboarding({
  hasBalance,
  hasPlayers,
  hasTrades,
  hasPrices,
}: {
  hasBalance: boolean;
  hasPlayers: boolean;
  hasTrades: boolean;
  hasPrices: boolean;
}) {
  const steps = [
    { done: hasBalance, title: "Set your starting coin balance", body: "So available coins and portfolio value are accurate.", action: <Button asChild size="sm" variant="outline"><Link href="/settings">Open settings</Link></Button> },
    { done: hasPlayers, title: "Add the players you trade", body: "Your private catalog. You can also import a CSV.", action: <PlayerDialog trigger={<Button size="sm" variant="outline">Add player</Button>} /> },
    { done: hasTrades, title: "Record a purchase", body: "Use “Record purchase” in the top bar.", action: null },
    { done: hasPrices, title: "Record prices you see in game", body: "Powers valuations, charts and alerts.", action: null },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-sm">Get set up</CardTitle>
        <CardDescription className="text-xs">{remaining} of {steps.length} steps left. Everything you enter stays private to your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.title} className="flex gap-2.5 text-sm">
              {s.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gain" aria-label="Done" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="To do" />
              )}
              <div className="grid gap-1.5">
                <p className={s.done ? "text-muted-foreground line-through" : "font-medium"}>{s.title}</p>
                {!s.done && <p className="text-xs text-muted-foreground">{s.body}</p>}
                {!s.done && s.action}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
