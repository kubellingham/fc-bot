-- =============================================================================
-- FC Market Intelligence — initial schema
--
-- Design notes
-- * Every user-owned table has a user_id column (defaulting to auth.uid()) and
--   row level security restricting all access to the owner.
-- * Child tables reference parents through composite foreign keys
--   (parent_id, user_id) → parent(id, user_id). A row can therefore only ever
--   point at a parent owned by the same user, independently of RLS.
-- * Coin amounts are bigint (whole coins, exact). Tax rates are numeric(5,4).
-- * Derived financial values (net proceeds, P&L, average cost) are NOT stored.
--   They are computed by the tested module in src/lib/finance from these inputs,
--   so they can never drift out of sync. Each sale snapshots the tax rate in
--   force when it was recorded.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: public-facing identity (never contains credentials)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- user_settings: preferences and the coin ledger's opening balance
-- -----------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  starting_coin_balance bigint not null default 0
    check (starting_coin_balance between 0 and 10000000000),
  tax_rate numeric(5, 4) not null default 0.0500 check (tax_rate >= 0 and tax_rate < 1),
  number_locale text not null default 'en-US'
    check (number_locale in ('en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'it-IT', 'nl-NL', 'pt-BR')),
  compact_numbers boolean not null default false,
  theme text not null default 'system' check (theme in ('system', 'dark', 'light')),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  alert_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- players: each user's own catalog of cards (no shared, user-editable catalog)
-- -----------------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  version text not null default 'Base' check (char_length(version) between 1 and 40 and version = btrim(version)),
  rating smallint check (rating between 1 and 99),
  position text check (position in ('GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST')),
  club text check (char_length(club) <= 60),
  league text check (char_length(league) <= 60),
  nation text check (char_length(nation) <= 60),
  rarity text check (char_length(rarity) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_id_user_key unique (id, user_id)
);
create unique index players_user_name_version_key on public.players (user_id, lower(name), lower(version));

-- -----------------------------------------------------------------------------
-- trades: one row per purchase ("lot"). Sales are recorded in trade_sales.
-- Status (open / partial / closed) is derived from the sales.
-- -----------------------------------------------------------------------------
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  player_id uuid not null,
  quantity integer not null check (quantity between 1 and 10000),
  unit_cost bigint not null check (unit_cost between 0 and 15000000),
  acquired_at timestamptz not null check (acquired_at >= '2000-01-01'),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trades_id_user_key unique (id, user_id),
  -- NO ACTION (not RESTRICT) so deleting a whole account can cascade through
  -- both tables in one statement, while deleting a player that still has
  -- trades is refused.
  constraint trades_player_fkey foreign key (player_id, user_id) references public.players (id, user_id)
);
create index trades_user_acquired_idx on public.trades (user_id, acquired_at desc);
create index trades_player_idx on public.trades (player_id, user_id);

create table public.trade_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trade_id uuid not null,
  quantity integer not null check (quantity between 1 and 10000),
  unit_price bigint not null check (unit_price between 1 and 15000000),
  tax_rate numeric(5, 4) not null check (tax_rate >= 0 and tax_rate < 1),
  sold_at timestamptz not null check (sold_at >= '2000-01-01'),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_sales_trade_fkey foreign key (trade_id, user_id)
    references public.trades (id, user_id) on delete cascade
);
create index trade_sales_trade_idx on public.trade_sales (trade_id, user_id);
create index trade_sales_user_sold_idx on public.trade_sales (user_id, sold_at desc);

-- A sale may not oversell its lot or predate the purchase. The parent trade row
-- is locked so concurrent sales against the same lot are serialised.
create or replace function private.validate_trade_sale()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_quantity integer;
  v_acquired_at timestamptz;
  v_already_sold integer;
begin
  select t.quantity, t.acquired_at
    into v_quantity, v_acquired_at
    from public.trades t
   where t.id = new.trade_id and t.user_id = new.user_id
     for update;

  if not found then
    raise exception 'Trade not found.' using errcode = '23503';
  end if;

  if new.sold_at < v_acquired_at then
    raise exception 'A sale cannot be dated before its purchase.'
      using errcode = '23514', constraint = 'trade_sales_sold_after_acquired';
  end if;

  select coalesce(sum(s.quantity), 0)
    into v_already_sold
    from public.trade_sales s
   where s.trade_id = new.trade_id and s.id <> new.id;

  if v_already_sold + new.quantity > v_quantity then
    raise exception 'Cannot sell % copies: % of % already sold.', new.quantity, v_already_sold, v_quantity
      using errcode = '23514', constraint = 'trade_sales_quantity_within_trade';
  end if;

  return new;
end;
$$;

create trigger trade_sales_validate
  before insert or update of quantity, sold_at, trade_id on public.trade_sales
  for each row execute function private.validate_trade_sale();

-- Editing a lot may not leave it with fewer copies than were sold, or move the
-- purchase after its first sale.
create or replace function private.validate_trade_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sold integer;
  v_first_sale timestamptz;
begin
  select coalesce(sum(s.quantity), 0), min(s.sold_at)
    into v_sold, v_first_sale
    from public.trade_sales s
   where s.trade_id = new.id;

  if new.quantity < v_sold then
    raise exception 'Quantity cannot be lower than the % copies already sold.', v_sold
      using errcode = '23514', constraint = 'trades_quantity_covers_sales';
  end if;

  if v_first_sale is not null and new.acquired_at > v_first_sale then
    raise exception 'Purchase date cannot be after the first sale.'
      using errcode = '23514', constraint = 'trades_acquired_before_sales';
  end if;

  return new;
end;
$$;

create trigger trades_validate
  before update of quantity, acquired_at on public.trades
  for each row execute function private.validate_trade_update();

-- -----------------------------------------------------------------------------
-- coin_adjustments: coins earned or spent outside trading, and reconciliations
-- -----------------------------------------------------------------------------
create table public.coin_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount bigint not null check (amount <> 0 and amount between -10000000000 and 10000000000),
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  occurred_at timestamptz not null default now() check (occurred_at >= '2000-01-01'),
  created_at timestamptz not null default now()
);
create index coin_adjustments_user_idx on public.coin_adjustments (user_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- watchlist_items
-- -----------------------------------------------------------------------------
create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  player_id uuid not null,
  target_buy_price bigint check (target_buy_price between 1 and 15000000),
  target_sell_price bigint check (target_sell_price between 1 and 15000000),
  notes text check (char_length(notes) <= 500),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watchlist_items_user_player_key unique (user_id, player_id),
  constraint watchlist_items_targets_ordered
    check (target_buy_price is null or target_sell_price is null or target_buy_price < target_sell_price),
  constraint watchlist_items_player_fkey foreign key (player_id, user_id)
    references public.players (id, user_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- price_observations: prices the user saw in game. Never fetched automatically.
-- -----------------------------------------------------------------------------
create table public.price_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  player_id uuid not null,
  price bigint not null check (price between 1 and 15000000),
  observed_at timestamptz not null check (observed_at >= '2000-01-01'),
  source text not null default 'manual' check (source in ('manual', 'import')),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  constraint price_observations_id_user_key unique (id, user_id),
  constraint price_observations_player_fkey foreign key (player_id, user_id)
    references public.players (id, user_id) on delete cascade
);
create index price_observations_player_time_idx on public.price_observations (player_id, observed_at desc, id desc);
create index price_observations_user_time_idx on public.price_observations (user_id, observed_at desc);

-- Latest observation per player. security_invoker makes the view respect the
-- caller's RLS policies on price_observations.
create view public.latest_price_observations
with (security_invoker = true)
as
select distinct on (o.player_id)
       o.id, o.user_id, o.player_id, o.price, o.observed_at
  from public.price_observations o
 order by o.player_id, o.observed_at desc, o.id desc;

-- -----------------------------------------------------------------------------
-- alerts and alert_events
-- -----------------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  player_id uuid not null,
  alert_type text not null check (alert_type in ('price_below', 'price_above', 'pct_change')),
  target_value numeric(12, 2) not null check (target_value > 0),
  lookback_hours integer check (lookback_hours between 1 and 2160),
  direction text not null default 'any' check (direction in ('any', 'up', 'down')),
  is_active boolean not null default true,
  is_triggered boolean not null default false,
  last_triggered_at timestamptz,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alerts_id_user_key unique (id, user_id),
  constraint alerts_player_fkey foreign key (player_id, user_id)
    references public.players (id, user_id) on delete cascade,
  constraint alerts_target_in_range check (
    case
      when alert_type = 'pct_change' then target_value <= 1000
      else target_value <= 15000000 and target_value = trunc(target_value)
    end
  ),
  constraint alerts_pct_options check (
    alert_type = 'pct_change' or (lookback_hours is null and direction = 'any')
  )
);
create index alerts_user_player_idx on public.alerts (user_id, player_id) where is_active;

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  alert_id uuid not null,
  observation_id uuid,
  observed_price bigint not null check (observed_price between 1 and 15000000),
  message text not null check (char_length(message) <= 300),
  triggered_at timestamptz not null default now(),
  read_at timestamptz,
  constraint alert_events_alert_fkey foreign key (alert_id, user_id)
    references public.alerts (id, user_id) on delete cascade,
  constraint alert_events_observation_fkey foreign key (observation_id, user_id)
    references public.price_observations (id, user_id) on delete set null (observation_id)
);
create index alert_events_user_time_idx on public.alert_events (user_id, triggered_at desc);
create index alert_events_unread_idx on public.alert_events (user_id) where read_at is null;
create index alert_events_alert_idx on public.alert_events (alert_id, user_id);
create index alert_events_observation_idx on public.alert_events (observation_id, user_id);

-- -----------------------------------------------------------------------------
-- ai_insights: cached AI (or rule-based fallback) briefings
-- -----------------------------------------------------------------------------
create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'briefing' check (kind in ('briefing')),
  source text not null check (source in ('ai', 'rules')),
  model text check (char_length(model) <= 100),
  content jsonb not null check (pg_column_size(content) <= 65536),
  generated_at timestamptz not null default now()
);
create index ai_insights_user_time_idx on public.ai_insights (user_id, kind, generated_at desc);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function private.set_updated_at();
create trigger players_updated_at before update on public.players
  for each row execute function private.set_updated_at();
create trigger trades_updated_at before update on public.trades
  for each row execute function private.set_updated_at();
create trigger trade_sales_updated_at before update on public.trade_sales
  for each row execute function private.set_updated_at();
create trigger watchlist_items_updated_at before update on public.watchlist_items
  for each row execute function private.set_updated_at();
create trigger alerts_updated_at before update on public.alerts
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Privileges: nothing for anon; CRUD (no TRUNCATE/REFERENCES/TRIGGER) for
-- authenticated, always filtered by the RLS policies below.
-- -----------------------------------------------------------------------------
revoke all on table
  public.profiles, public.user_settings, public.players, public.trades, public.trade_sales,
  public.coin_adjustments, public.watchlist_items, public.price_observations, public.alerts,
  public.alert_events, public.ai_insights, public.latest_price_observations
from anon, authenticated;

grant select, insert, update on table public.profiles, public.user_settings to authenticated;
grant select, insert, update, delete on table
  public.players, public.trades, public.trade_sales, public.coin_adjustments, public.watchlist_items,
  public.price_observations, public.alerts, public.alert_events
to authenticated;
grant select, insert, delete on table public.ai_insights to authenticated;
grant select on table public.latest_price_observations to authenticated;

-- -----------------------------------------------------------------------------
-- Row level security
-- (select auth.uid()) is evaluated once per statement rather than per row.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.players enable row level security;
alter table public.trades enable row level security;
alter table public.trade_sales enable row level security;
alter table public.coin_adjustments enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.price_observations enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;
alter table public.ai_insights enable row level security;

create policy "profiles: owner can read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner can insert" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: owner can update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "user_settings: owner can read" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_settings: owner can insert" on public.user_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_settings: owner can update" on public.user_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'players', 'trades', 'trade_sales', 'coin_adjustments', 'watchlist_items',
    'price_observations', 'alerts', 'alert_events', 'ai_insights'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || ': owner can read', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || ': owner can insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || ': owner can update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || ': owner can delete', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rate limiting for expensive endpoints (AI, imports). Fixed windows, stored in
-- a schema PostgREST does not expose; only reachable through the function.
-- -----------------------------------------------------------------------------
create table private.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table private.rate_limits enable row level security;

create or replace function public.consume_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_window timestamptz;
  v_hits integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;
  if p_bucket not in ('ai_short', 'ai_daily', 'import') or p_limit < 1 or p_window_seconds not between 1 and 604800 then
    raise exception 'Invalid rate limit parameters.' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  delete from private.rate_limits
   where user_id = v_uid and window_start < now() - interval '8 days';

  insert into private.rate_limits as r (user_id, bucket, window_start, hits)
  values (v_uid, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Self-service account deletion. Deletes only the caller's auth user; every
-- table above cascades from auth.users, so all of the user's data goes with it.
-- Avoids shipping a service-role key to the application server.
-- -----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Trigger functions are internal; nobody needs to call them directly.
revoke all on function private.set_updated_at() from public;
revoke all on function private.validate_trade_sale() from public;
revoke all on function private.validate_trade_update() from public;
