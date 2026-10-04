"use client";

import { Plus, Tag, ShoppingCart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ObservationDialog } from "@/components/features/observation-dialog";
import { PlayerDialog } from "@/components/features/player-dialog";
import { TradeDialog } from "@/components/features/trade-dialog";
import type { PickerPlayer } from "@/components/forms/player-picker";

/** Global shortcuts for the three most frequent manual entries. */
export function QuickActions({ players, taxRate }: { players: PickerPlayer[]; taxRate: number }) {
  if (players.length === 0) {
    return (
      <PlayerDialog
        trigger={
          <Button size="sm">
            <UserPlus />
            <span className="hidden sm:inline">Add player</span>
          </Button>
        }
      />
    );
  }
  return (
    <div className="flex items-center gap-2">
      <ObservationDialog
        players={players}
        trigger={
          <Button size="sm" variant="outline">
            <Tag />
            <span className="hidden sm:inline">Record price</span>
          </Button>
        }
      />
      <TradeDialog
        players={players}
        taxRate={taxRate}
        trigger={
          <Button size="sm">
            <ShoppingCart />
            <span className="hidden sm:inline">Record purchase</span>
            <Plus className="sm:hidden" aria-hidden="true" />
            <span className="sr-only sm:hidden">Record purchase</span>
          </Button>
        }
      />
    </div>
  );
}
