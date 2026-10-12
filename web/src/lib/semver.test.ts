import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bumpFor,
  nextVersion,
  normalizeRepoUrl,
  resolveVersion,
} from "../../scripts/semver.mjs";

const c = (subject: string, body = "") => ({ subject, body });

describe("nextVersion", () => {
  it("bumps major for type!: and BREAKING CHANGE footers", () => {
    expect(nextVersion("1.2.3", [c("feat!: drop old api")])).toBe("2.0.0");
    expect(nextVersion("1.2.3", [c("fix(api)!: rename")])).toBe("2.0.0");
    expect(nextVersion("1.2.3", [c("fix: x", "details\n\nBREAKING CHANGE: gone")])).toBe("2.0.0");
    expect(nextVersion("1.2.3", [c("chore: x", "BREAKING-CHANGE: gone")])).toBe("2.0.0");
  });

  it("bumps minor for feat and patch for fix/perf", () => {
    expect(nextVersion("1.2.3", [c("feat: a")])).toBe("1.3.0");
    expect(nextVersion("1.2.3", [c("fix: a")])).toBe("1.2.4");
    expect(nextVersion("1.2.3", [c("perf: a")])).toBe("1.2.4");
  });

  it("takes the highest bump across commits", () => {
    expect(nextVersion("1.2.3", [c("fix: a"), c("feat(web): b"), c("docs: c")])).toBe("1.3.0");
    expect(nextVersion("1.2.3", [c("feat: a"), c("fix!: b")])).toBe("2.0.0");
  });

  it("parses scopes", () => {
    expect(bumpFor([c("feat(web): a")])).toBe("minor");
    expect(bumpFor([c("fix(queue,ingest): a")])).toBe("patch");
    expect(bumpFor([c("feat(web)!: a")])).toBe("major");
  });

  it("ignores non-releasing and merge commits", () => {
    const commits = [
      c("docs: a"),
      c("chore(deps): b"),
      c("ci: c"),
      c("test: d"),
      c("refactor: e"),
      c("build: f"),
      c("style: g"),
      c("Merge feat/x into main"),
      c("Merge pull request #1 from a/feat-x", "feat: looks releasable"),
      c("random message"),
    ];
    expect(bumpFor(commits)).toBeNull();
    expect(nextVersion("1.2.3", commits)).toBe("1.2.3");
  });

  it("accepts a trailing squash-merge PR number", () => {
    expect(nextVersion("1.2.3", [c("feat(web): add thing (#123)")])).toBe("1.3.0");
    expect(nextVersion("1.2.3", [c("fix!: thing (#9)")])).toBe("2.0.0");
  });

  it("treats the type case-insensitively", () => {
    expect(bumpFor([c("Feat: a")])).toBe("minor");
    expect(bumpFor([c("FIX(api): a")])).toBe("patch");
    expect(bumpFor([c("Feat!: a")])).toBe("major");
  });

  it("applies plain semver to 0.x (no special 0.x rules)", () => {
    expect(nextVersion("0.3.4", [c("feat: a")])).toBe("0.4.0");
    expect(nextVersion("0.3.4", [c("fix: a")])).toBe("0.3.5");
    expect(nextVersion("0.3.4", [c("feat!: a")])).toBe("1.0.0");
  });

  it("keeps the same version with no commits", () => {
    expect(nextVersion("1.0.0", [])).toBe("1.0.0");
  });
});

describe("normalizeRepoUrl", () => {
  it("normalises common remote forms", () => {
    expect(normalizeRepoUrl("https://github.com/o/r.git")).toBe("https://github.com/o/r");
    expect(normalizeRepoUrl("git@github.com:o/r.git")).toBe("https://github.com/o/r");
    expect(normalizeRepoUrl("git+https://github.com/o/r.git")).toBe("https://github.com/o/r");
    expect(normalizeRepoUrl("nonsense")).toBeNull();
    expect(normalizeRepoUrl(undefined)).toBeNull();
  });
});

describe("resolveVersion", () => {
  const dirs: string[] = [];
  const tmp = () => {
    const dir = mkdtempSync(join(tmpdir(), "semver-test-"));
    dirs.push(dir);
    return dir;
  };
  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  it("never throws and falls back without a git repo", () => {
    const dir = tmp();
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "4.5.6" }));
    const result = resolveVersion({ cwd: dir, env: { VERCEL_GIT_COMMIT_SHA: "a".repeat(40) } });
    expect(result.fallback).toBe(true);
    expect(result.version).toBe("4.5.6");
    expect(result.sha).toBe("a".repeat(40));
    expect(result.shortSha).toBe("aaaaaaa");
  });

  it("never throws on a missing directory", () => {
    const result = resolveVersion({ cwd: join(tmp(), "nope"), env: {} });
    expect(result.fallback).toBe(true);
    expect(result.sha).toBe("unknown");
  });

  it("computes the version from tags and commits in a real repo", () => {
    const dir = tmp();
    mkdirSync(dir, { recursive: true });
    const git = (...args: string[]) =>
      execFileSync(
        "git",
        ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
        { cwd: dir, stdio: "ignore" },
      );
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.0.1" }));
    git("init", "-q");
    git("add", ".");
    git("commit", "-q", "-m", "chore: init");
    git("tag", "v1.0.0");
    git("commit", "-q", "--allow-empty", "-m", "docs: words");

    let result = resolveVersion({ cwd: dir, env: {} });
    expect(result).toMatchObject({
      version: "1.0.0",
      base: "1.0.0",
      bump: null,
      released: true,
      fallback: false,
    });

    git("commit", "-q", "--allow-empty", "-m", "feat(web): thing");
    git("commit", "-q", "--allow-empty", "-m", "fix: other");
    result = resolveVersion({ cwd: dir, env: {} });
    // Pending feat: the v1.1.0 tag does not exist yet, so no release link.
    expect(result).toMatchObject({ version: "1.1.0", bump: "minor", released: false, fallback: false });
    expect(result.sha).toHaveLength(40);
    expect(result.shortSha).toBe(result.sha.slice(0, 7));

    // Vercel production build: release.yml tags main moments later.
    result = resolveVersion({ cwd: dir, env: { VERCEL_ENV: "production" } });
    expect(result).toMatchObject({ version: "1.1.0", released: true });
    result = resolveVersion({ cwd: dir, env: { VERCEL_ENV: "preview" } });
    expect(result.released).toBe(false);
  });

  it("fetches tags and history for a shallow clone without tags (local bare remote)", () => {
    const work = tmp();
    const bare = tmp();
    const clone = join(tmp(), "clone");
    const run = (cwd: string, ...args: string[]) =>
      execFileSync(
        "git",
        ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
        { cwd, stdio: "ignore" },
      );
    writeFileSync(join(work, "package.json"), JSON.stringify({ version: "0.0.1" }));
    run(work, "init", "-q", "-b", "main");
    run(work, "add", ".");
    run(work, "commit", "-q", "-m", "chore: init");
    run(work, "tag", "v2.0.0");
    run(work, "commit", "-q", "--allow-empty", "-m", "fix: a");
    run(work, "commit", "-q", "--allow-empty", "-m", "feat: b (#2)");
    run(work, "commit", "-q", "--allow-empty", "-m", "docs: c");
    run(bare, "init", "-q", "--bare", "-b", "main");
    run(work, "push", "-q", bare, "main", "--tags");

    const url = `file://${bare}`;
    run(tmpdir(), "clone", "-q", "--depth=1", "--no-tags", url, clone);
    const shallow = () =>
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: clone }).toString().trim();
    expect(shallow()).toBe("true");

    // Without a usable fetch URL the shallow clone cannot know: fallback.
    expect(resolveVersion({ cwd: clone, env: {}, fetchUrl: join(tmp(), "missing") }).fallback).toBe(true);

    const result = resolveVersion({ cwd: clone, env: {}, fetchUrl: url });
    expect(result).toMatchObject({ version: "2.1.0", base: "2.0.0", bump: "minor", fallback: false });
    expect(shallow()).toBe("false");
  });
});
