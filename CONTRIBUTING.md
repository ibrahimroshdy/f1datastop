# Contributing to F1 DataStop

Thanks for your interest. The website lives in `web/`, database migrations and server functions in `supabase/`, and the Python scripts in `analysis/`. The full documentation is at https://docs.f1datastop.com. Start with [Getting started](https://docs.f1datastop.com/getting-started.html) to run the site on your computer.

## Workflow

1. Create a branch from `main`.
2. Make focused changes: one concern per pull request when possible.
3. Run the checks from the top folder before you open a pull request:

```bash
npm run typecheck
npm run lint        # 0 errors required
npm run test
npm run build
```

If you changed `analysis/`, also run:

```bash
python -m compileall -q analysis
cd analysis && python -m unittest discover -s tests
```

If you changed a schedule or a workflow, run `python .github/scripts/check_schedules.py`.

4. Open a pull request with a short summary and how you tested it. Use Conventional Commit messages and a conventional pull request title (`feat(web): add X`, `fix: Y`, `feat!: Z` for a breaking change). The `pr-title` check requires it, because a squash merge makes the title the commit message. Versions and GitHub Releases are created automatically from these, so never change a version or tag by hand. See [Releases](https://docs.f1datastop.com/releases.html).

## Code conventions

- **TypeScript strict mode.** Avoid `any`; use typed interfaces from `web/src/lib/f1/types.ts`.
- **Logic in `lib/`.** Keep components thin; calculations belong in `web/src/lib/f1/`.
- **UI.** Use the F1 components (`F1Card`, `F1EmptyState`, `F1ErrorState`, `F1Skeleton`) as described in [AGENTS.md](AGENTS.md). Charts use Recharts or D3 inside `F1ChartContainer`. Design tokens are in `web/src/index.css`.
- **Data.** Use the React Query hooks in `web/src/hooks/f1/` and the keys in `web/src/lib/f1/queryKeys.ts`.
- **Settings.** Optional keys are `VITE_*` variables read in `web/src/config/integrations.ts`; do not hardcode ids.

## Tests

Tests use [Vitest](https://vitest.dev/) and sit next to the code they cover (`*.test.ts`). Good places for new tests: `web/src/lib/f1/` (adapters and calculations), `web/src/lib/api/` (address parsing, proxy switch) and `supabase/functions/_shared/cacheTtl.ts` (cache keys and lifetimes).

```bash
npm run test          # once
npm run test:watch    # watch mode (from web/)
```

## Questions

Open a [GitHub issue](https://github.com/ibrahimroshdy/f1datastop/issues) for bugs or ideas before large changes. For security problems, see [SECURITY.md](SECURITY.md) instead.
