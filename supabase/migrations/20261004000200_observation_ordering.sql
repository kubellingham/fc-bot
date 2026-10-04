-- Observations recorded with the same observed_at (e.g. two prices entered in
-- the same minute) are ordered by when they were recorded, so "latest price"
-- is deterministic and matches what the user entered last.

create or replace view public.latest_price_observations
with (security_invoker = true)
as
select distinct on (o.player_id)
       o.id, o.user_id, o.player_id, o.price, o.observed_at
  from public.price_observations o
 order by o.player_id, o.observed_at desc, o.created_at desc, o.id desc;

drop index if exists public.price_observations_player_time_idx;
create index price_observations_player_time_idx
  on public.price_observations (player_id, observed_at desc, created_at desc, id desc);
