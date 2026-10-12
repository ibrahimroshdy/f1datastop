## Summary

<!-- What does this pull request do, and why? -->

## Type of change

<!-- The pull request title must be a conventional commit, e.g. `feat(web): add a tyre chart`.
     It decides the next version: feat = minor, fix/perf = patch, `!` = major. -->

- [ ] feat: new feature
- [ ] fix: bug fix
- [ ] perf: performance improvement
- [ ] refactor: code restructuring (no behaviour change)
- [ ] docs: documentation only
- [ ] chore / test: maintenance, CI, config or tests

## How I tested it

<!-- Steps, screenshots or logs. -->

## Checklist

- [ ] `npm run typecheck && npm run lint && npm run test && npm run build` pass
- [ ] If I changed Python: `python -m compileall -q analysis` and `cd analysis && python -m unittest discover -s tests` pass
- [ ] If I changed a schedule or workflow: `python .github/scripts/check_schedules.py` passes and `docs/pipeline.html` is updated
- [ ] The docs site (`docs/`) is updated if behaviour changed

## Breaking changes

<!-- API changes, environment variables, migrations or removed features. "None" if none. -->
