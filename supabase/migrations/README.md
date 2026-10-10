# Supabase setup (fresh project)

Migration files in this directory are the source of truth:
`00000000000000_baseline.sql` (fresh-DB squash) plus forward migrations.

## Fresh-project order

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy f1-proxy
supabase functions deploy bmc-webhook --no-verify-jwt
supabase secrets set BMC_WEBHOOK_SECRET=<secret>
```

Then add CI secrets (repo Settings → Secrets) used by `.github/workflows/pr-ci.yml`:

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
  `BLOB_PUBLIC_BASE`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `SLACK_ALERTS_WEBHOOK` (digest job)

## Notes

- `bmc-webhook` is public (`verify_jwt = false` in `supabase/config.toml`)
  and authenticates via `BMC_WEBHOOK_SECRET`.
- Request queues (`f1_chart_requests`, `f1_telemetry_requests`) are drained by
  the `queue` job in `pr-ci.yml` (every 5 min); no per-request dispatch
  triggers remain.
