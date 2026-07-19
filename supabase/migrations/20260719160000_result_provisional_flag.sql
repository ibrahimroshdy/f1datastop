-- Mark results that were ingested before Ergast published the round.
--
-- FastF1 fills DriverId, TeamId, GridPosition, Status, Points and Laps only from Ergast,
-- which lags a race by hours. The ingester now derives those from live timing so a
-- finished race is usable within minutes, but the derived values are approximations:
-- status is a plain Finished/Retired instead of Ergast's "+1 Lap"/"Accident"/…, points
-- assume full race distance, and race time is absent entirely.
--
-- Without a marker there is no way to tell a derived row from an authoritative one, and
-- _round_done() treats any round with results as finished — so the cron would skip it
-- forever and the provisional values would never be replaced. This flag lets the
-- reconcile keep retrying a round until Ergast lands, then settle.

alter table public.f1_race_result
  add column if not exists provisional boolean not null default false;

alter table public.f1_sprint_result
  add column if not exists provisional boolean not null default false;

comment on column public.f1_race_result.provisional is
  'True when the row was derived from live timing because Ergast had not published the round yet. Reconcile re-ingests provisional rounds until authoritative data replaces them.';

-- Backfill: 2026 R10 (Spa) was ingested from live timing while Ergast was still silent.
update public.f1_race_result
set provisional = true
where season = 2026 and round = 10;
