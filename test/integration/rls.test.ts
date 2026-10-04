/**
 * Row level security, privileges and data-integrity rules, exercised through the
 * real Auth + Data APIs of the local Supabase stack (the same path the app uses).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, stackIsReachable, withDb, type TestUser } from "./helpers";

const USER_TABLES = [
  "profiles",
  "user_settings",
  "players",
  "trades",
  "trade_sales",
  "coin_adjustments",
  "watchlist_items",
  "price_observations",
  "alerts",
  "alert_events",
  "ai_insights",
  "latest_price_observations",
] as const;

let alice: TestUser;
let bob: TestUser;
const a: Record<string, string> = {};

beforeAll(async () => {
  if (!(await stackIsReachable())) {
    throw new Error("Local Supabase stack is not running. Start it with `pnpm db:start`.");
  }
  [alice, bob] = await Promise.all([createTestUser("alice"), createTestUser("bob")]);

  const c = alice.client;
  const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
    if (r.error || r.data === null || r.data === undefined) throw r.error ?? new Error("no data");
    return r.data as NonNullable<T>;
  };
  must(await c.from("profiles").insert({ display_name: "Alice" }));
  must(await c.from("user_settings").insert({ starting_coin_balance: 100_000 }));
  a.player = must(await c.from("players").insert({ name: "Alice Striker", version: "TOTW" }).select("id").single()).id;
  a.trade = must(
    await c
      .from("trades")
      .insert({ player_id: a.player, quantity: 2, unit_cost: 10_000, acquired_at: "2026-09-01T00:00:00Z" })
      .select("id")
      .single(),
  ).id;
  a.sale = must(
    await c
      .from("trade_sales")
      .insert({ trade_id: a.trade, quantity: 1, unit_price: 12_000, tax_rate: 0.05, sold_at: "2026-09-02T00:00:00Z" })
      .select("id")
      .single(),
  ).id;
  a.observation = must(
    await c
      .from("price_observations")
      .insert({ player_id: a.player, price: 11_000, observed_at: "2026-09-03T00:00:00Z" })
      .select("id")
      .single(),
  ).id;
  a.watch = must(await c.from("watchlist_items").insert({ player_id: a.player, target_buy_price: 9_000 }).select("id").single()).id;
  a.alert = must(
    await c.from("alerts").insert({ player_id: a.player, alert_type: "price_below", target_value: 9_500 }).select("id").single(),
  ).id;
  a.event = must(
    await c
      .from("alert_events")
      .insert({ alert_id: a.alert, observation_id: a.observation, observed_price: 11_000, message: "test" })
      .select("id")
      .single(),
  ).id;
  a.adjustment = must(await c.from("coin_adjustments").insert({ amount: 500, reason: "Objectives" }).select("id").single()).id;
  a.insight = must(
    await c.from("ai_insights").insert({ source: "rules", content: { summary: "x" } }).select("id").single(),
  ).id;
});

describe("user isolation", () => {
  it.each(USER_TABLES)("%s: another user sees none of Alice's rows", async (table) => {
    const own = await alice.client.from(table).select("*");
    expect(own.error).toBeNull();
    expect(own.data?.length).toBeGreaterThan(0);

    const other = await bob.client.from(table).select("*");
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);
  });

  it("a user cannot update another user's rows (0 rows affected, data unchanged)", async () => {
    const res = await bob.client.from("trades").update({ unit_cost: 1 }).eq("id", a.trade).select();
    expect(res.data).toEqual([]);
    const check = await alice.client.from("trades").select("unit_cost").eq("id", a.trade).single();
    expect(check.data?.unit_cost).toBe(10_000);
  });

  it("a user cannot delete another user's rows", async () => {
    for (const [table, id] of [
      ["players", a.player],
      ["trade_sales", a.sale],
      ["price_observations", a.observation],
      ["alerts", a.alert],
      ["coin_adjustments", a.adjustment],
    ] as const) {
      const res = await bob.client.from(table).delete().eq("id", id).select();
      expect(res.data, table).toEqual([]);
    }
    const still = await alice.client.from("players").select("id").eq("id", a.player);
    expect(still.data).toHaveLength(1);
  });

  it("a user cannot insert rows on behalf of someone else", async () => {
    const res = await bob.client.from("players").insert({ user_id: alice.id, name: "Spoofed" });
    expect(res.error?.code).toBe("42501"); // RLS with-check violation
  });

  it("a user cannot reassign their own row to another user", async () => {
    const own = await bob.client.from("players").insert({ name: "Bob Keeper" }).select("id").single();
    const res = await bob.client.from("players").update({ user_id: alice.id }).eq("id", own.data!.id);
    expect(res.error?.code).toBe("42501");
  });

  it("a user cannot attach records to another user's player, even knowing its id", async () => {
    const trade = await bob.client
      .from("trades")
      .insert({ player_id: a.player, quantity: 1, unit_cost: 1, acquired_at: "2026-09-01T00:00:00Z" });
    expect(trade.error?.code).toBe("23503"); // composite FK (player_id, user_id)
    const obs = await bob.client.from("price_observations").insert({ player_id: a.player, price: 1, observed_at: "2026-09-01T00:00:00Z" });
    expect(obs.error?.code).toBe("23503");
  });

  it("a user cannot record a sale against another user's trade", async () => {
    const res = await bob.client
      .from("trade_sales")
      .insert({ trade_id: a.trade, quantity: 1, unit_price: 1, tax_rate: 0.05, sold_at: "2026-09-05T00:00:00Z" });
    expect(res.error).not.toBeNull();
    const sold = await alice.client.from("trade_sales").select("id").eq("trade_id", a.trade);
    expect(sold.data).toHaveLength(1);
  });
});

describe("anonymous access", () => {
  it.each(USER_TABLES)("%s: anonymous requests are refused", async (table) => {
    const res = await anonClient().from(table).select("*");
    expect(res.error?.code).toBe("42501");
  });

  it("anonymous users cannot call privileged functions", async () => {
    const anon = anonClient();
    expect((await anon.rpc("delete_my_account")).error).not.toBeNull();
    expect((await anon.rpc("consume_rate_limit", { p_bucket: "ai_short", p_limit: 5, p_window_seconds: 60 })).error).not.toBeNull();
  });

  it("internal functions and tables are not exposed through the API", async () => {
    const res = await alice.client.rpc("validate_trade_sale");
    expect(res.error).not.toBeNull();
    const schema = await alice.client.schema("private").from("rate_limits").select("*");
    expect(schema.error).not.toBeNull();
  });
});

describe("data integrity", () => {
  it("refuses to sell more copies than a lot holds", async () => {
    const res = await alice.client
      .from("trade_sales")
      .insert({ trade_id: a.trade, quantity: 2, unit_price: 12_000, tax_rate: 0.05, sold_at: "2026-09-04T00:00:00Z" });
    expect(res.error?.code).toBe("23514");
    expect(res.error?.message).toMatch(/1 of 2 already sold/);
  });

  it("serialises concurrent sales so a lot can never be oversold", async () => {
    const lot = await alice.client
      .from("trades")
      .insert({ player_id: a.player, quantity: 1, unit_cost: 5_000, acquired_at: "2026-09-01T00:00:00Z" })
      .select("id")
      .single();
    const sell = () =>
      alice.client
        .from("trade_sales")
        .insert({ trade_id: lot.data!.id, quantity: 1, unit_price: 6_000, tax_rate: 0.05, sold_at: "2026-09-02T00:00:00Z" });
    const results = await Promise.all([sell(), sell(), sell()]);
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    const rows = await alice.client.from("trade_sales").select("quantity").eq("trade_id", lot.data!.id);
    expect(rows.data).toHaveLength(1);
  });

  it("refuses a sale dated before its purchase", async () => {
    const res = await alice.client
      .from("trade_sales")
      .insert({ trade_id: a.trade, quantity: 1, unit_price: 12_000, tax_rate: 0.05, sold_at: "2026-08-01T00:00:00Z" });
    expect(res.error?.message).toMatch(/before its purchase/);
  });

  it("refuses to reduce a lot below the copies already sold", async () => {
    const res = await alice.client.from("trades").update({ quantity: 0 }).eq("id", a.trade);
    expect(res.error).not.toBeNull();
    const below = await alice.client
      .from("trades")
      .update({ acquired_at: "2026-09-10T00:00:00Z" })
      .eq("id", a.trade);
    expect(below.error?.message).toMatch(/after the first sale/);
  });

  it("rejects invalid values with check constraints", async () => {
    const c = alice.client;
    expect((await c.from("trades").insert({ player_id: a.player, quantity: 1, unit_cost: -5, acquired_at: "2026-09-01T00:00:00Z" })).error?.code).toBe("23514");
    expect((await c.from("price_observations").insert({ player_id: a.player, price: 0, observed_at: "2026-09-01T00:00:00Z" })).error?.code).toBe("23514");
    expect((await c.from("user_settings").update({ tax_rate: 1 }).eq("user_id", alice.id)).error?.code).toBe("23514");
    expect((await c.from("coin_adjustments").insert({ amount: 0, reason: "nothing" })).error?.code).toBe("23514");
    expect((await c.from("alerts").insert({ player_id: a.player, alert_type: "price_below", target_value: 10.5 })).error?.code).toBe("23514");
    expect((await c.from("alerts").insert({ player_id: a.player, alert_type: "price_below", target_value: 10, lookback_hours: 24 })).error?.code).toBe("23514");
  });

  it("requires a watchlist buy target below the sell target", async () => {
    const res = await alice.client.from("watchlist_items").update({ target_sell_price: 8_000 }).eq("id", a.watch);
    expect(res.error?.code).toBe("23514");
  });

  it("treats player name + version as unique per user, case-insensitively", async () => {
    const dup = await alice.client.from("players").insert({ name: "alice striker", version: "totw" });
    expect(dup.error?.code).toBe("23505");
    // A different user may use the same name.
    const other = await bob.client.from("players").insert({ name: "Alice Striker", version: "TOTW" });
    expect(other.error).toBeNull();
  });

  it("refuses to delete a player that still has trades, but cascades observations otherwise", async () => {
    const res = await alice.client.from("players").delete().eq("id", a.player);
    expect(res.error?.code).toBe("23503");

    const p = await alice.client.from("players").insert({ name: "Temp" }).select("id").single();
    await alice.client.from("price_observations").insert({ player_id: p.data!.id, price: 100, observed_at: "2026-09-01T00:00:00Z" });
    expect((await alice.client.from("players").delete().eq("id", p.data!.id)).error).toBeNull();
    const left = await alice.client.from("price_observations").select("id").eq("player_id", p.data!.id);
    expect(left.data).toEqual([]);
  });

  it("serves the latest observation per player through the view", async () => {
    await alice.client.from("price_observations").insert({ player_id: a.player, price: 9_999, observed_at: "2026-09-04T00:00:00Z" });
    const res = await alice.client.from("latest_price_observations").select("player_id, price").eq("player_id", a.player);
    expect(res.data).toEqual([{ player_id: a.player, price: 9_999 }]);
  });
});

describe("rate limiting", () => {
  it("allows requests up to the limit within a window, then refuses", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { data, error } = await bob.client.rpc("consume_rate_limit", { p_bucket: "import", p_limit: 3, p_window_seconds: 3600 });
      expect(error).toBeNull();
      results.push(data as boolean);
    }
    expect(results).toEqual([true, true, true, false]);
  });

  it("rejects unknown buckets", async () => {
    const res = await bob.client.rpc("consume_rate_limit", { p_bucket: "anything", p_limit: 3, p_window_seconds: 60 });
    expect(res.error?.code).toBe("22023");
  });
});

describe("account deletion", () => {
  it("deletes only the caller's account and all of their data", async () => {
    const carol = await createTestUser("carol");
    const p = await carol.client.from("players").insert({ name: "Carol's card" }).select("id").single();
    await carol.client.from("trades").insert({ player_id: p.data!.id, quantity: 1, unit_cost: 1, acquired_at: "2026-09-01T00:00:00Z" });

    const res = await carol.client.rpc("delete_my_account");
    expect(res.error).toBeNull();

    await withDb(async (db) => {
      const users = await db.query("select count(*)::int as n from auth.users where id = $1", [carol.id]);
      const players = await db.query("select count(*)::int as n from public.players where user_id = $1", [carol.id]);
      const trades = await db.query("select count(*)::int as n from public.trades where user_id = $1", [carol.id]);
      expect([users.rows[0].n, players.rows[0].n, trades.rows[0].n]).toEqual([0, 0, 0]);
      const aliceStill = await db.query("select count(*)::int as n from auth.users where id = $1", [alice.id]);
      expect(aliceStill.rows[0].n).toBe(1);
    });
  });
});

describe("database hardening", () => {
  it("enables RLS on every table in the public schema", async () => {
    await withDb(async (db) => {
      const res = await db.query(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
      );
      expect(res.rows).toEqual([]);
    });
  });

  it("grants nothing to anon and no TRUNCATE to authenticated", async () => {
    await withDb(async (db) => {
      const res = await db.query(
        `select table_name, grantee, privilege_type from information_schema.role_table_grants
          where table_schema = 'public'
            and (grantee = 'anon' or (grantee = 'authenticated' and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')))`,
      );
      expect(res.rows).toEqual([]);
    });
  });

  it("pins search_path on every function we define", async () => {
    await withDb(async (db) => {
      const res = await db.query(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname in ('public', 'private') and p.prokind = 'f'
            and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
      );
      expect(res.rows).toEqual([]);
    });
  });
});
