# Changelog

All notable changes to this project are documented here, per
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Version source of
truth: `web/package.json` `version`. Versions are markers + changelog, not
deploy gates — Vercel keeps shipping `main` on every push.

## [1.0.0] - 2026-10-10

First public open-source release: the platform is now fully auth-free.

### Removed

- Supabase Auth, `profiles`, login/callback routes, and all auth gates — every
  page renders with zero login.
- Prediction game (frontend, `game_*` tables/RPCs/crons) and profile pages.
- Web Push (`save-push-subscription`, `send-push`, VAPID vars) and the
  `NotificationToggle` PWA block.
- reCAPTCHA (`captcha-verify` edge function, site/secret keys).
- Slack signup notifier (`notify-slack`, `SLACK_WEBHOOK_URL`).

### Changed

- Chart and telemetry requests are anonymous (`requested_by` nullable, no
  login upsell).
- `/developers` is the public technical-docs hub (API endpoint docs,
  rate-limit policy, embed options).
- Single-commit public history (migration squash); stale docs, one-shot
  scripts, and dead config removed.

### Added

- Fork-safe GitHub Actions PR CI (`.github/workflows/pr-ci.yml`): web
  typecheck, advisory lint, test, build + Python byte-compile smoke check.
  Zero secrets.
- `NOTICE` with third-party attribution.
