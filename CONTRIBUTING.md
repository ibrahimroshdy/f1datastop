# Contributing to F1 DataStop

Thanks for your interest in contributing. This project is a monorepo: the React app lives in `web/`, Supabase migrations and edge functions in `supabase/`.

## Prerequisites

- Node.js 20+ (22 recommended)
- npm
- Optional: [Supabase CLI](https://supabase.com/docs/guides/cli) for local edge-function work

## Getting started

```bash
git clone https://github.com/ibrahimroshdy/f1datastop.git
cd f1datastop
npm install --prefix web
cp .env.example web/.env.local
# Fill in VITE_SUPABASE_* at minimum — see .env.example
npm run dev
```

The dev server runs at http://localhost:8080.

## Development workflow

1. Create a branch from `main`.
2. Make focused changes — one concern per PR when possible.
3. Run checks locally before opening a PR:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

4. Open a pull request with a short summary and test plan.

## Code conventions

- **TypeScript strict mode** — avoid `any`; prefer typed interfaces in `web/src/lib/f1/types.ts`.
- **Business logic in `lib/`** — keep components thin; calculations belong in `web/src/lib/f1/`.
- **UI components** — use the F1 design system (`F1Card`, `F1EmptyState`, `F1ErrorState`, `F1Skeleton`) per `.cursor/` docs.
- **Data fetching** — React Query hooks in `web/src/hooks/f1/`; use hierarchical keys from `web/src/lib/f1/queryKeys.ts`.
- **Integrations** — all optional keys via `VITE_*` env vars in `web/src/config/integrations.ts`; no hardcoded IDs in source.

## Testing

Tests use [Vitest](https://vitest.dev/) and live next to the code they cover (`*.test.ts`).

Priority areas for new tests:

- `web/src/lib/f1/` — adapters, position/overtake calculations
- `web/src/lib/api/` — URL parsing, proxy gating
- `supabase/functions/_shared/cacheTtl.ts` — cache key + TTL logic

Run tests:

```bash
npm run test          # once
npm run test:watch    # watch mode (from web/)
```

## Project layout

```
f1datastop/
├── web/                 # Vite + React frontend
│   └── src/
│       ├── components/  # UI by feature
│       ├── hooks/f1/      # React Query data hooks
│       ├── lib/f1/        # Canonical types, adapters, calc logic
│       └── lib/api/       # F1 API fetch + proxy helpers
├── supabase/
│   ├── functions/       # Edge functions (f1-proxy, bmc-webhook)
│   └── migrations/      # Postgres schema
└── .github/workflows/   # CI
```

## Environment variables

See [`.env.example`](.env.example) for the full list. Required for data access:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Optional integrations (GA4, Clarity, AdSense) are no-ops when unset.

## Questions

Open a [GitHub issue](https://github.com/ibrahimroshdy/f1datastop/issues) for bugs or feature discussions before large changes.
