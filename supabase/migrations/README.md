# Supabase migrations — state & drift

Project ref: `envqfquhkcbnitwlzepx`

## Known drift (as of 2026-06-20)

The remote database and these migration files are **not fully in sync**:

- Remote migration history tracked only `20260510121725` plus the advisor fix
  applied on 2026-06-20 (`20260620000000_harden_function_search_path`).
- The two older files (`20230810_…`, `20231201_…`) describe the original
  `trivia_scores` schema but predate the tracked history.

To fully reconcile repo ⇄ remote, run once (requires CLI login):

```bash
supabase login
supabase link --project-ref envqfquhkcbnitwlzepx
supabase db pull            # writes a baseline migration matching remote
supabase migration list     # repo and remote should now match
```

## Current remote schema (source of truth, captured 2026-06-20)

Tables (both RLS-enabled):

- `public.profiles` — id (uuid, pk → auth.users.id), username (unique),
  first_name, last_name, created_at, updated_at. 758 rows.
  RLS: users may select/insert/update/delete only their own row (`auth.uid() = id`).
- `public.trivia_scores` — id (uuid, pk), user_id (→ auth.users.id), username,
  score, correct_answers, total_questions, time_spent, game_mode
  ('normal'|'destructive'), is_public, created_at, updated_at. 88 rows.
  RLS: insert/update/delete own; read own; read public (`is_public OR own`).
  Trigger `update_trivia_scores_updated_at` → `update_updated_at_column()`.

Functions:

- `handle_new_user()` — SECURITY DEFINER trigger on `auth.users`, inserts a
  `profiles` row. search_path pinned; RPC EXECUTE revoked from anon/authenticated.
- `update_updated_at_column()` — sets `updated_at = now()`. search_path pinned.

Edge functions (sources in `../functions/`):

- `notify-slack` — optional Slack signup notifier (no-op without `SLACK_WEBHOOK_URL`).
- `captcha-verify` — server-side reCAPTCHA verification (needs `RECAPTCHA_SECRET_KEY`).
