#!/usr/bin/env node
/**
 * Creates (or reuses) a demo account and fills it with realistic sample data
 * through the public Auth + Data APIs — the same RLS-protected path the app uses.
 * For local development, screenshots and end-to-end tests only.
 *
 *   node scripts/seed-demo.mjs [email] [password]
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the
 * environment, falling back to the local Docker stack.
 */
import { createClient } from "@supabase/supabase-js";
import { stackConfig } from "./local-supabase-lib.mjs";

const email = process.argv[2] ?? "demo@example.test";
const password = process.argv[3] ?? "demo-password-123";
const local = stackConfig();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? local.url;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? local.anonKey;

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn() {
  const login = await supabase.auth.signInWithPassword({ email, password });
  if (!login.error) return login.data.user;
  const signup = await supabase.auth.signUp({ email, password });
  if (signup.error || !signup.data.session) throw new Error(`Could not create demo user: ${signup.error?.message ?? "email confirmation required"}`);
  return signup.data.user;
}

function must(result, what) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

// Deterministic pseudo-random numbers so every seed looks the same.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const user = await signIn();
console.log(`Seeding ${email} (${user.id})`);

// Start from a clean slate for this account (cascades remove dependent rows).
must(await supabase.from("trades").delete().eq("user_id", user.id), "clear trades");
must(await supabase.from("players").delete().eq("user_id", user.id), "clear players");
must(await supabase.from("coin_adjustments").delete().eq("user_id", user.id), "clear adjustments");
must(await supabase.from("ai_insights").delete().eq("user_id", user.id), "clear insights");

must(
  await supabase.from("user_settings").upsert(
    { user_id: user.id, starting_coin_balance: 2_500_000, tax_rate: 0.05, number_locale: "en-GB", timezone: "Europe/London", theme: "dark" },
    { onConflict: "user_id" },
  ),
  "settings",
);
must(await supabase.from("profiles").upsert({ id: user.id, display_name: "Demo Trader" }, { onConflict: "id" }), "profile");

const PLAYERS = [
  { name: "Kylian Mbappé", version: "Base", rating: 91, position: "ST", club: "Real Madrid", league: "LALIGA EA SPORTS", nation: "France", rarity: "Rare", base: 1_150_000, drift: 0.002 },
  { name: "Florian Wirtz", version: "TOTW", rating: 89, position: "CAM", club: "Liverpool", league: "Premier League", nation: "Germany", rarity: "TOTW", base: 182_000, drift: -0.006 },
  { name: "Lamine Yamal", version: "Base", rating: 86, position: "RW", club: "FC Barcelona", league: "LALIGA EA SPORTS", nation: "Spain", rarity: "Rare", base: 96_000, drift: 0.004 },
  { name: "Virgil van Dijk", version: "Base", rating: 89, position: "CB", club: "Liverpool", league: "Premier League", nation: "Netherlands", rarity: "Rare", base: 64_000, drift: -0.001 },
  { name: "Aitana Bonmatí", version: "Base", rating: 91, position: "CM", club: "FC Barcelona", league: "Liga F", nation: "Spain", rarity: "Rare", base: 210_000, drift: 0.003 },
  { name: "Jamal Musiala", version: "Base", rating: 88, position: "CAM", club: "FC Bayern München", league: "Bundesliga", nation: "Germany", rarity: "Rare", base: 48_000, drift: -0.003 },
  { name: "Gianluigi Donnarumma", version: "Base", rating: 87, position: "GK", club: "Paris SG", league: "Ligue 1", nation: "Italy", rarity: "Rare", base: 21_500, drift: 0.0 },
  { name: "Bukayo Saka", version: "In-Form", rating: 89, position: "RW", club: "Arsenal", league: "Premier League", nation: "England", rarity: "TOTW", base: 135_000, drift: 0.005 },
];

const players = must(
  await supabase
    .from("players")
    .insert(PLAYERS.map((p) => ({ name: p.name, version: p.version, rating: p.rating, position: p.position, club: p.club, league: p.league, nation: p.nation, rarity: p.rarity })))
    .select("id, name"),
  "players",
);
const idOf = (name) => players.find((p) => p.name === name).id;

// FC prices move in fixed steps; round to a plausible tick.
const tick = (p) => (p < 10_000 ? Math.round(p / 100) * 100 : p < 100_000 ? Math.round(p / 250) * 250 : Math.round(p / 1000) * 1000);

const DAY = 86_400_000;
const now = Date.now();
const observations = [];
const priceAt = new Map();
for (const p of PLAYERS) {
  let price = p.base;
  const series = [];
  for (let d = 60; d >= 0; d--) {
    const shocks = d === 18 && p.name === "Florian Wirtz" ? -0.18 : 0; // a visible promo crash
    price = Math.max(1000, price * (1 + p.drift + (rand() - 0.5) * 0.05 + shocks));
    const observedAt = new Date(now - d * DAY - Math.floor(rand() * 6) * 3_600_000).toISOString();
    if (d % 2 === 0 || d < 7) {
      const value = tick(price);
      observations.push({ player_id: idOf(p.name), price: value, observed_at: observedAt, source: "manual" });
      series.push({ t: Date.parse(observedAt), price: value });
    }
  }
  priceAt.set(p.name, series);
}
must(await supabase.from("price_observations").insert(observations), "observations");

const near = (name, daysAgo) => {
  const series = priceAt.get(name);
  const t = now - daysAgo * DAY;
  return series.reduce((best, s) => (Math.abs(s.t - t) < Math.abs(best.t - t) ? s : best)).price;
};
const at = (daysAgo, h = 19) => new Date(now - daysAgo * DAY + (h - 12) * 3_600_000).toISOString();

const TRADES = [
  { name: "Lamine Yamal", qty: 3, buyDay: 50, sell: [{ qty: 3, day: 41, markup: 1.12 }] },
  { name: "Virgil van Dijk", qty: 2, buyDay: 45, sell: [{ qty: 2, day: 33, markup: 0.97 }] },
  { name: "Florian Wirtz", qty: 1, buyDay: 24, sell: [{ qty: 1, day: 15, markup: 0.84 }] },
  { name: "Bukayo Saka", qty: 2, buyDay: 30, sell: [{ qty: 1, day: 12, markup: 1.09 }] },
  { name: "Aitana Bonmatí", qty: 1, buyDay: 20, sell: [] },
  { name: "Jamal Musiala", qty: 4, buyDay: 9, sell: [] },
  { name: "Gianluigi Donnarumma", qty: 5, buyDay: 38, sell: [{ qty: 5, day: 30, markup: 1.07 }] },
  { name: "Lamine Yamal", qty: 2, buyDay: 6, sell: [] },
  { name: "Kylian Mbappé", qty: 1, buyDay: 3, sell: [] },
];

for (const t of TRADES) {
  const unitCost = tick(near(t.name, t.buyDay) * 0.97);
  const trade = must(
    await supabase
      .from("trades")
      .insert({ player_id: idOf(t.name), quantity: t.qty, unit_cost: unitCost, acquired_at: at(t.buyDay, 20), notes: null })
      .select("id")
      .single(),
    "trade",
  );
  for (const s of t.sell) {
    must(
      await supabase.from("trade_sales").insert({
        trade_id: trade.id,
        quantity: s.qty,
        unit_price: tick(near(t.name, s.day) * s.markup),
        tax_rate: 0.05,
        sold_at: at(s.day, 21),
      }),
      "sale",
    );
  }
}

must(
  await supabase.from("coin_adjustments").insert([
    { amount: 85_000, reason: "Weekly objectives and rivals rewards", occurred_at: at(28) },
    { amount: -150_000, reason: "Opened 2 × 75k packs", occurred_at: at(14) },
  ]),
  "adjustments",
);

const latest = (name) => priceAt.get(name).at(-1).price;
must(
  await supabase.from("watchlist_items").insert([
    { player_id: idOf("Florian Wirtz"), target_buy_price: tick(latest("Florian Wirtz") * 1.02), target_sell_price: tick(latest("Florian Wirtz") * 1.35) },
    { player_id: idOf("Kylian Mbappé"), target_buy_price: tick(latest("Kylian Mbappé") * 0.9), target_sell_price: tick(latest("Kylian Mbappé") * 1.15) },
    { player_id: idOf("Jamal Musiala"), target_buy_price: tick(latest("Jamal Musiala") * 0.95), target_sell_price: tick(latest("Jamal Musiala") * 1.2) },
    { player_id: idOf("Aitana Bonmatí"), target_buy_price: null, target_sell_price: tick(latest("Aitana Bonmatí") * 0.98) },
  ]),
  "watchlist",
);

must(
  await supabase.from("alerts").insert([
    // Bulk inserts need identical keys on every row, or PostgREST writes NULL instead of column defaults.
    { player_id: idOf("Kylian Mbappé"), alert_type: "price_below", target_value: tick(latest("Kylian Mbappé") * 0.92), lookback_hours: null, direction: "any" },
    { player_id: idOf("Florian Wirtz"), alert_type: "pct_change", target_value: 10, lookback_hours: 168, direction: "any" },
    { player_id: idOf("Bukayo Saka"), alert_type: "price_above", target_value: tick(latest("Bukayo Saka") * 1.1), lookback_hours: null, direction: "any" },
  ]),
  "alerts",
);

console.log(`Done: ${players.length} players, ${observations.length} price observations, ${TRADES.length} purchases.`);
console.log(`Sign in with ${email} / ${password}`);
