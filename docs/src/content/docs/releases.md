---
title: Releases
description: "How F1 DataStop version numbers and GitHub Releases are created automatically from commit messages."
---

Version numbers are automatic. You never edit a version or create a tag by hand: the commit messages decide.

## How a version is chosen

Every push to `main` is checked by [`release.yml`](https://github.com/ibrahimroshdy/f1datastop/blob/main/.github/workflows/release.yml). It looks at every commit since the newest `vX.Y.Z` tag and picks the highest change:

| Commit type | Next version | Example |
| --- | --- | --- |
| `feat` | Minor: 1.2.0 becomes 1.3.0 | `feat(web): add a tyre chart` |
| `fix` or `perf` | Patch: 1.2.0 becomes 1.2.1 | `fix: correct the sprint points` |
| A `!` after the type, or a `BREAKING CHANGE:` line in the message | Major: 1.2.0 becomes 2.0.0 | `feat!: remove the old embed address` |
| Anything else (`docs`, `chore`, `test`, `refactor` and so on) | No release | `docs: fix a typo` |

When there is something to release, the workflow creates the `vX.Y.Z` tag and a GitHub Release with generated notes. Tags and releases are not commits, so no workflow ever commits to the repository. The notes live on the [Releases page](https://github.com/ibrahimroshdy/f1datastop/releases).

The version is worked out by one script, [`web/scripts/semver.mjs`](https://github.com/ibrahimroshdy/f1datastop/blob/main/web/scripts/semver.mjs). The build uses it to write the version into the site, and `release.yml` uses it to choose the next tag, so the two always agree.

## Writing commit messages and pull request titles

Use the form `type(scope): subject`, for example `feat(web): add a tyre chart`. The scope is optional. Pull request titles must follow the same form (the `pr-title` check enforces it), because a squash merge turns the title into the commit message.

Do not edit `version` in `web/package.json` and do not tag by hand. That number is only a fallback for builds that cannot read the git history.

## Which version is the site running?

Each deployment tells you which build it is:

- The footer of the site shows `v<version>` and a short commit id. The commit id links to the commit on GitHub, and the version links to its GitHub Release when that release exists.
- `https://www.f1datastop.com/version.json` returns the same information: the version, the full and short commit id, the build time, the repository and whether the version has been released.

A version marks a commit, not a deployment. The site is deployed on every push to `main`, so several deployments can share one version. The commit id tells them apart.

## Running the release step again

Open the Actions tab on GitHub, choose Release and press "Run workflow". If the tag already exists, nothing happens.
