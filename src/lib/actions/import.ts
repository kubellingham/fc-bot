"use server";

import { randomUUID } from "node:crypto";
import { evaluateAlertsForPlayer } from "@/lib/alerts/evaluate";
import {
  checkHeaders,
  importRequestSchema,
  parseRow,
  playerKey,
  type ImportEntity,
  type ParsedRow,
  type PlayerRef,
} from "@/lib/csv/definitions";
import { fetchAll } from "@/lib/data/fetch-all";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/security/rate-limit";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { runAction, throwDb, UserFacingError } from "./runner";

export interface PreviewRow {
  line: number;
  status: "valid" | "invalid" | "duplicate";
  label: string;
  messages: string[];
}

export interface ImportPreview {
  entity: ImportEntity;
  rows: PreviewRow[];
  counts: { valid: number; invalid: number; duplicate: number };
  playersToCreate: string[];
}

interface Analysis extends ImportPreview {
  accepted: { line: number; row: ParsedRow }[];
  playerIds: Map<string, string>;
  missingPlayers: Map<string, PlayerRef>;
}

const label = (p: PlayerRef) => (p.version && p.version !== "Base" ? `${p.name} (${p.version})` : p.name);
const ms = (iso: string) => String(Date.parse(iso));

/**
 * Validates every row, resolves players and flags duplicates — both against
 * existing records and within the file. Never modifies anything.
 */
async function analyze(
  supabase: TypedSupabaseClient,
  userId: string,
  entity: ImportEntity,
  rows: Record<string, string>[],
  createMissingPlayers: boolean,
): Promise<Analysis> {
  const settings = await supabase.from("user_settings").select("timezone").eq("user_id", userId).maybeSingle();
  throwDb(settings.error);
  const timeZone = settings.data?.timezone ?? "UTC";

  const players = await fetchAll("players", (from, to) => supabase.from("players").select("id, name, version").order("id").range(from, to));
  const playerIds = new Map(players.map((p) => [playerKey(p), p.id]));

  const parsed = rows.map((raw, i) => ({ line: i + 2, ...parseRow(entity, raw, timeZone) }));
  const involvedIds = [
    ...new Set(
      parsed.flatMap((p) => (p.row && p.row.entity !== "players" ? [playerIds.get(playerKey(p.row.player))].filter((x): x is string => Boolean(x)) : [])),
    ),
  ];

  // Existing records that an imported row could duplicate.
  const existing = new Set<string>();
  if (entity === "players") {
    for (const key of playerIds.keys()) existing.add(key);
  } else if (involvedIds.length > 0) {
    if (entity === "observations") {
      const obs = await fetchAll("observations", (from, to) =>
        supabase.from("price_observations").select("player_id, price, observed_at").in("player_id", involvedIds).order("id").range(from, to),
      );
      for (const o of obs) existing.add(`${o.player_id}|${o.price}|${ms(o.observed_at)}`);
    } else {
      const trades = await fetchAll("trades", (from, to) =>
        supabase.from("trades").select("player_id, quantity, unit_cost, acquired_at").in("player_id", involvedIds).order("id").range(from, to),
      );
      for (const t of trades) existing.add(`${t.player_id}|${t.quantity}|${t.unit_cost}|${ms(t.acquired_at)}`);
    }
  }

  const seen = new Set<string>();
  const missingPlayers = new Map<string, PlayerRef>();
  const accepted: Analysis["accepted"] = [];
  const out: PreviewRow[] = [];

  for (const p of parsed) {
    if (!p.row) {
      out.push({ line: p.line, status: "invalid", label: "—", messages: p.errors });
      continue;
    }
    const row = p.row;
    const pKey = playerKey(row.player);
    const messages: string[] = [];
    let dupKey: string;

    if (row.entity === "players") {
      dupKey = pKey;
    } else {
      const playerId = playerIds.get(pKey);
      if (!playerId) {
        if (!createMissingPlayers) {
          out.push({
            line: p.line,
            status: "invalid",
            label: label(row.player),
            messages: [`Unknown player "${label(row.player)}". Import players first, or allow creating missing players.`],
          });
          continue;
        }
        missingPlayers.set(pKey, row.player);
        messages.push(`Will create player "${label(row.player)}".`);
      }
      const ref = playerId ?? `new:${pKey}`;
      dupKey =
        row.entity === "observations"
          ? `${ref}|${row.price}|${ms(row.observedAt)}`
          : row.entity === "holdings"
            ? `${ref}|${row.quantity}|${row.unitCost}|${ms(row.acquiredAt)}`
            : `${ref}|${row.quantity}|${row.buyPrice}|${ms(row.boughtAt)}`;
    }

    if (existing.has(dupKey)) {
      out.push({ line: p.line, status: "duplicate", label: label(row.player), messages: ["Matches an existing record — will be skipped."] });
      continue;
    }
    if (seen.has(dupKey)) {
      out.push({ line: p.line, status: "duplicate", label: label(row.player), messages: ["Repeats an earlier row in this file — will be skipped."] });
      continue;
    }
    seen.add(dupKey);
    accepted.push({ line: p.line, row });
    out.push({ line: p.line, status: "valid", label: label(row.player), messages });
  }

  const counts = { valid: 0, invalid: 0, duplicate: 0 };
  for (const r of out) counts[r.status] += 1;
  return {
    entity,
    rows: out,
    counts,
    playersToCreate: [...missingPlayers.values()].map(label),
    accepted,
    playerIds,
    missingPlayers,
  };
}

function preview(a: Analysis): ImportPreview {
  return { entity: a.entity, rows: a.rows, counts: a.counts, playersToCreate: a.playersToCreate };
}

export async function previewImport(raw: unknown) {
  return runAction(importRequestSchema, raw, { name: "import.preview", refresh: false }, async (input, { supabase, user }) => {
    const headerErrors = checkHeaders(input.entity, input.headers);
    if (headerErrors.length) throw new UserFacingError(headerErrors.join(" "));
    return preview(await analyze(supabase, user.id, input.entity, input.rows, input.createMissingPlayers));
  });
}

const BATCH = 500;

async function insertInBatches<T extends object>(rows: T[], insert: (batch: T[]) => PromiseLike<{ error: import("@supabase/supabase-js").PostgrestError | null }>) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await insert(rows.slice(i, i + BATCH));
    throwDb(error, { "23505": "Some rows already exist. Run the preview again." });
  }
}

export interface ImportResult {
  imported: number;
  skipped: number;
  playersCreated: number;
}

/**
 * Re-validates the file server-side (the preview is never trusted), then
 * inserts only new, valid rows. Existing records are never updated. If any
 * step fails, rows inserted by this import are removed again.
 */
export async function commitImport(raw: unknown) {
  return runAction(importRequestSchema, raw, { name: "import.commit" }, async (input, { supabase, user }): Promise<ImportResult> => {
    const headerErrors = checkHeaders(input.entity, input.headers);
    if (headerErrors.length) throw new UserFacingError(headerErrors.join(" "));
    const limited = await checkRateLimit(supabase, ["import"]);
    if (limited) throw new UserFacingError(limited);

    const a = await analyze(supabase, user.id, input.entity, input.rows, input.createMissingPlayers);
    if (a.accepted.length === 0) throw new UserFacingError("There are no new, valid rows to import.");

    const created = { players: [] as string[], trades: [] as string[], observations: [] as string[] };
    try {
      // 1. Players (either the import itself, or missing players for other entities).
      const newPlayers =
        input.entity === "players"
          ? a.accepted.map(({ row }) => {
              const r = row as Extract<ParsedRow, { entity: "players" }>;
              return { id: randomUUID(), name: r.player.name, version: r.player.version, rating: r.rating, position: r.position, club: r.club, league: r.league, nation: r.nation, rarity: r.rarity };
            })
          : [...a.missingPlayers.values()].map((p) => ({ id: randomUUID(), name: p.name, version: p.version }));
      await insertInBatches(newPlayers, (b) => supabase.from("players").insert(b));
      created.players = newPlayers.map((p) => p.id);
      for (const p of newPlayers) a.playerIds.set(playerKey(p), p.id);
      const idFor = (ref: PlayerRef) => a.playerIds.get(playerKey(ref))!;

      // 2. Entity rows.
      if (input.entity === "observations") {
        const obs = a.accepted.map(({ row }) => {
          const r = row as Extract<ParsedRow, { entity: "observations" }>;
          return { id: randomUUID(), player_id: idFor(r.player), price: r.price, observed_at: r.observedAt, notes: r.notes, source: "import" };
        });
        await insertInBatches(obs, (b) => supabase.from("price_observations").insert(b));
        created.observations = obs.map((o) => o.id);
      } else if (input.entity === "holdings" || input.entity === "trades") {
        const tax = await supabase.from("user_settings").select("tax_rate").eq("user_id", user.id).maybeSingle();
        throwDb(tax.error);
        const taxRate = tax.data ? Number(tax.data.tax_rate) : 0.05;
        const trades: { id: string; player_id: string; quantity: number; unit_cost: number; acquired_at: string; notes: string | null }[] = [];
        const sales: { trade_id: string; quantity: number; unit_price: number; tax_rate: number; sold_at: string }[] = [];
        for (const { row } of a.accepted) {
          const id = randomUUID();
          if (row.entity === "holdings") {
            trades.push({ id, player_id: idFor(row.player), quantity: row.quantity, unit_cost: row.unitCost, acquired_at: row.acquiredAt, notes: row.notes });
          } else if (row.entity === "trades") {
            trades.push({ id, player_id: idFor(row.player), quantity: row.quantity, unit_cost: row.buyPrice, acquired_at: row.boughtAt, notes: row.notes });
            if (row.salePrice !== null && row.soldAt !== null) {
              sales.push({ trade_id: id, quantity: row.quantity, unit_price: row.salePrice, tax_rate: taxRate, sold_at: row.soldAt });
            }
          }
        }
        await insertInBatches(trades, (b) => supabase.from("trades").insert(b));
        created.trades = trades.map((t) => t.id);
        await insertInBatches(sales, (b) => supabase.from("trade_sales").insert(b));
      }
    } catch (error) {
      // Compensate: remove everything this import created (sales cascade from trades).
      if (created.trades.length) await supabase.from("trades").delete().in("id", created.trades);
      if (created.observations.length) await supabase.from("price_observations").delete().in("id", created.observations);
      if (created.players.length) await supabase.from("players").delete().in("id", created.players);
      logger.warn("import.rolled_back", { userId: user.id, entity: input.entity });
      throw error;
    }

    // Imported prices may meet alert conditions; evaluate affected players (bounded).
    if (input.entity === "observations") {
      const affected = [...new Set(a.accepted.map(({ row }) => a.playerIds.get(playerKey(row.player))!))].slice(0, 50);
      for (const playerId of affected) await evaluateAlertsForPlayer(supabase, user.id, playerId);
    }

    logger.info("import.completed", { userId: user.id, entity: input.entity, rows: a.accepted.length });
    return {
      imported: a.accepted.length,
      skipped: a.counts.invalid + a.counts.duplicate,
      playersCreated: input.entity === "players" ? 0 : a.missingPlayers.size,
    };
  });
}
