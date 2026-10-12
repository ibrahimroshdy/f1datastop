# Changelog

Version numbers are automatic: every push to `main` is checked and, when it contains a release-worthy change, a version tag and a GitHub Release are created from the commit messages. The release notes for each version live on the [Releases page](https://github.com/ibrahimroshdy/f1datastop/releases). See [Releases](https://docs.f1datastop.com/releases.html) for how it works.

## [1.0.0] - first open-source release

The first public release of F1 DataStop: a free Formula 1 site with standings, results, lap and position analysis, a race calendar, Deep Dive telemetry charts and replays, and embeddable standings widgets. Every page works without an account.

- Data comes from Jolpica/Ergast, FastF1 and OpenF1, stored in a Supabase database and published as files on a CDN.
- Scheduled jobs on GitHub Actions, started by a clock inside Supabase, keep results, charts and telemetry up to date.
- Visitors can request custom charts and telemetry, which are processed automatically.
- Versions and GitHub Releases are created automatically from conventional commit messages.
- Documentation is at https://docs.f1datastop.com.
