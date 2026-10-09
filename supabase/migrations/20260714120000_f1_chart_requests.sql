-- On-demand custom chart requests (Deep Dive "pick your drivers"). A queue drainer
-- drains pending rows, runs generate.py --only <chart> --drivers <codes>, and the
-- chart lands in analysis_charts under a driver-keyed chart_type. Deduped by the
-- unique key so the same driver set never regenerates.
create table if not exists public.f1_chart_requests (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  round int not null,
  session text not null default 'R',
  chart text not null,
  driver_key text not null,
  drivers text[] not null default '{}',
  status text not null default 'pending',
  public_url text,
  error text,
  requested_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season, round, session, chart, driver_key)
);

create index if not exists f1_chart_requests_status_idx
  on public.f1_chart_requests (status, created_at);

alter table public.f1_chart_requests enable row level security;

drop policy if exists "chart_requests_read" on public.f1_chart_requests;
drop policy if exists "chart_requests_insert" on public.f1_chart_requests;
create policy "chart_requests_read" on public.f1_chart_requests for select using (true);
create policy "chart_requests_insert" on public.f1_chart_requests for insert to authenticated
  with check (auth.uid() = requested_by);
