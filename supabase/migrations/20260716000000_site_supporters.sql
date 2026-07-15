-- Live "Buy me a PitStop" supporter count, kept current by the BuyMeACoffee
-- webhook (edge function `bmc-webhook`). The frontend reads it (anon) and falls
-- back to the hardcoded config number if unavailable.

create table if not exists public.site_supporters (
  id         int primary key default 1,
  count      int not null default 0,
  updated_at timestamptz not null default now(),
  constraint site_supporters_singleton check (id = 1)
);
-- seed with the current manual number so the count never regresses
insert into public.site_supporters (id, count) values (1, 2)
  on conflict (id) do nothing;

alter table public.site_supporters enable row level security;
drop policy if exists site_supporters_read on public.site_supporters;
create policy site_supporters_read on public.site_supporters
  for select to anon, authenticated using (true);
-- writes are service-role only (the edge function); no anon/auth write policy.

-- Idempotency: BuyMeACoffee retries webhooks, so each event is processed once.
create table if not exists public.bmc_webhook_event (
  event_id    text primary key,
  received_at timestamptz not null default now()
);
alter table public.bmc_webhook_event enable row level security;
-- no policies → only the service-role edge function can read/write it.

-- Atomic +1 (avoids a read-then-write race on concurrent webhooks).
create or replace function public.bmc_increment_supporters()
returns integer language sql security definer set search_path = public as $$
  update public.site_supporters set count = count + 1, updated_at = now()
  where id = 1 returning count;
$$;
revoke all on function public.bmc_increment_supporters() from public, anon, authenticated;
