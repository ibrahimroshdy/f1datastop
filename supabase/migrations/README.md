# Supabase setup (fresh project)

The full backend guide is at https://docs.f1datastop.com/backend.html and the schedule list at https://docs.f1datastop.com/pipeline.html. This file keeps the short notes that belong next to the migrations.

Migration files in this directory are the source of truth:
`00000000000000_baseline.sql` (fresh-DB squash) plus forward migrations.

## Fresh-project order

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy f1-proxy
supabase functions deploy bmc-webhook --no-verify-jwt
supabase functions deploy f1-livetiming-proxy --no-verify-jwt
supabase secrets set BMC_WEBHOOK_SECRET=<secret> F1_PROXY_TOKEN=<token>
```

Then add CI secrets (repo Settings → Secrets) used by the workflows in `.github/workflows/`:

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
  `BLOB_PUBLIC_BASE`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `F1_LIVETIMING_PROXY` (FastF1 fetches routed around CDN blocks on GitHub runners)
- `SLACK_ALERTS_WEBHOOK` (digest job)

## Notes

- `bmc-webhook` is public (`verify_jwt = false` in `supabase/config.toml`)
  and authenticates via `BMC_WEBHOOK_SECRET`.
- `f1-livetiming-proxy` is public (`verify_jwt = false`) and authenticates via a
  path token (`F1_PROXY_TOKEN`); it routes FastF1 livetiming fetches around
  CDN blocks on GitHub-hosted runners.
- Request queues (`f1_chart_requests`, `f1_telemetry_requests`) are drained by
  the `queue` workflow (`.github/workflows/queue.yml`). Rows are CHECK-validated,
  and a BEFORE INSERT guard rejects new rows while 500 are already pending.
- `20261012120000_dispatch_queue_on_request.sql` starts that workflow from the
  database: AFTER INSERT (status `pending`) and AFTER UPDATE OF status (to
  `pending`) triggers call `public.f1_dispatch_queue()`, which POSTs GitHub's
  workflow-dispatch endpoint through `pg_net` (installed in `extensions`).
  Best-effort: any error is downgraded to a WARNING, never failing the write.
  The function is SECURITY DEFINER, executable by `service_role` only. It reads
  the Vault secret `github_actions_dispatch_token` (no secret = no-op) and the
  optional `github_actions_dispatch_repo` (default `ibrahimroshdy/f1datastop`).
  Owner setup, in the SQL editor (fine-grained PAT limited to this repo with
  Actions: Read and write): `select vault.create_secret('<token>',
  'github_actions_dispatch_token');`. `f1_dispatch_queue()` is now a wrapper
  over the generic dispatcher from the next migration.
- `20261012130000_pg_cron_clock.sql` makes `pg_cron` the clock: adds
  `public.f1_dispatch_workflow(p_workflow text, p_inputs jsonb)` (same hardening:
  SECURITY DEFINER, pinned `search_path`, Vault token, never raises; `service_role`
  only) and six `cron.schedule()` jobs `f1ds-*` (UTC) that dispatch `queue.yml`
  (`*/5 * * * *`) and `pipeline.yml` (`job` = reconcile / charts / assets / digest;
  the race-weekend reconcile also passes `gate=true`). Jobs run as `postgres`, which
  owns the function. `cron.schedule()` upserts by name, so re-running is safe. The
  GitHub `schedule:` blocks are removed (later migration: one digest backup remains);
  `.github/scripts/check_schedules.py` (PR CI) enforces both. Owner setup is unchanged (existing Vault secret). To pause a job:
  `select cron.unschedule('f1ds-charts');` (re-running the migration restores it).
- `20261012140000_clock_robustness.sql` hardens the clock: `f1_dispatch_workflow` gets
  `search_path = pg_catalog, pg_temp`; new `public.f1_dispatch_queue_if_needed()` (the
  `f1ds-queue` tick now dispatches `queue.yml` only when a chart/telemetry request is `pending`
  or `processing` and untouched for 30 minutes); new `public.f1_dispatch_health(p_hours)` (JSON
  of failed GitHub dispatches and failed `f1ds-*` cron runs, read by the daily digest;
  `service_role` only; pg_net keeps responses about 6 h, so the JSON reports the effective
  window). Schedules get distinct minutes: reconcile `7 */6`, charts `15 */2 * * 5,6,0`,
  assets `25 6,12,18 * * 5,6,0`. `check_schedules.py` reads this file. The single remaining GitHub
  `schedule:` is the once-a-day backup for the digest in `pipeline.yml` (`41 7 * * *`).
- Migration filenames must carry the exact version recorded in
  `supabase_migrations.schema_migrations` (`supabase migration list`). Apply
  with `supabase db push`, not the MCP `apply_migration` (it stamps its own
  version and causes drift).
- `20261012000000_catch_up_prod_drift.sql` backports changes first made
  directly in production (FK indexes, pinned `search_path`) and hardens the
  public schema (no `TRUNCATE` for anon/authenticated, `pg_net` removed,
  `requested_by` dropped).
