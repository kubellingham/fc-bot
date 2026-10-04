import type { AlertDirection, AlertType } from "@/lib/finance/alerts";
import type { CoinAdjustment, LotRecord, PriceObservation, SaleRecord } from "@/lib/finance/types";

/** Application-level records (camelCase) mapped from database rows. */

export interface Player {
  id: string;
  name: string;
  version: string;
  rating: number | null;
  position: string | null;
  club: string | null;
  league: string | null;
  nation: string | null;
  rarity: string | null;
  createdAt: string;
}

export interface Settings {
  displayName: string | null;
  startingCoinBalance: number;
  taxRate: number;
  numberLocale: string;
  compactNumbers: boolean;
  theme: "system" | "dark" | "light";
  timezone: string;
  alertNotifications: boolean;
  /** False until the user saves settings for the first time. */
  persisted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  displayName: null,
  startingCoinBalance: 0,
  taxRate: 0.05,
  numberLocale: "en-US",
  compactNumbers: false,
  theme: "system",
  timezone: "UTC",
  alertNotifications: true,
  persisted: false,
};

export interface Trade extends LotRecord {
  notes: string | null;
  createdAt: string;
}

export interface Sale extends SaleRecord {
  notes: string | null;
}

export interface Observation extends PriceObservation {
  source: "manual" | "import";
  notes: string | null;
}

export interface WatchlistItem {
  id: string;
  playerId: string;
  targetBuyPrice: number | null;
  targetSellPrice: number | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface Alert {
  id: string;
  playerId: string;
  type: AlertType;
  targetValue: number;
  lookbackHours: number | null;
  direction: AlertDirection;
  isActive: boolean;
  isTriggered: boolean;
  lastTriggeredAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  alertId: string;
  observationId: string | null;
  observedPrice: number;
  message: string;
  triggeredAt: string;
  readAt: string | null;
}

export interface Adjustment extends CoinAdjustment {
  reason: string;
}

export function playerLabel(p: Pick<Player, "name" | "version">): string {
  return p.version && p.version !== "Base" ? `${p.name} (${p.version})` : p.name;
}
