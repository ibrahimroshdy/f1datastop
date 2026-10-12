// Single source of truth for the app version. Used by vite.config.ts, generate-version.mjs and
// (in CLI mode) .github/workflows/release.yml.
//
// The version is derived from conventional commits since the newest `vX.Y.Z` tag reachable from
// HEAD; nothing is ever committed. Tags/GitHub Releases are created by the release workflow.
//
//   node scripts/semver.mjs        -> prints the resolved result as JSON
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAG_RE = /^v(\d+)\.(\d+)\.(\d+)$/;
const SUBJECT_RE = /^(\w+)(\([^)]*\))?(!)?: /;
const BREAKING_FOOTER_RE = /^BREAKING[ -]CHANGE: /m;
const GIT_TIMEOUT_MS = 60_000;
const FETCH_TIMEOUT_MS = 20_000; // network: an offline shallow build must not stall

/** Bump level of one commit: "major" | "minor" | "patch" | null. */
export function commitBump(commit) {
  const subject = (commit?.subject ?? "").trim();
  const body = commit?.body ?? "";
  if (/^Merge /.test(subject)) return null;
  const match = SUBJECT_RE.exec(subject);
  if (match && match[3]) return "major";
  if (BREAKING_FOOTER_RE.test(body)) return "major";
  if (!match) return null;
  const type = match[1].toLowerCase();
  if (type === "feat") return "minor";
  if (type === "fix" || type === "perf") return "patch";
  return null;
}

/** Highest bump over `commits` ({subject, body}), or null when nothing is releasable. */
export function bumpFor(commits) {
  let level = null;
  for (const commit of commits) {
    const bump = commitBump(commit);
    if (bump === "major") return "major";
    if (bump === "minor") level = "minor";
    else if (bump === "patch" && level === null) level = "patch";
  }
  return level;
}

/** Pure: next version after `lastVersion` ("1.2.3") given the commits since its tag. */
export function nextVersion(lastVersion, commits) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(lastVersion ?? "");
  if (!match) return lastVersion;
  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
  switch (bumpFor(commits ?? [])) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      return `${major}.${minor}.${patch}`;
  }
}

/** Normalise a git remote (https, ssh, scp-style) to https://host/owner/repo, or null. */
export function normalizeRepoUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let url = raw.trim().replace(/^git\+/, "");
  const scp = /^[\w.-]+@([\w.-]+):(.+)$/.exec(url);
  if (scp) url = `https://${scp[1]}/${scp[2]}`;
  url = url.replace(/^ssh:\/\/[\w.-]+@/, "https://").replace(/^git:\/\//, "https://");
  url = url.replace(/\.git$/, "").replace(/\/+$/, "");
  return /^https?:\/\/[^/]+\/[^/]+\/[^/]+/.test(url) ? url : null;
}

function git(args, cwd, timeout = GIT_TIMEOUT_MS) {
  return execFileSync("git", args, {
    cwd,
    timeout,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
}

function tryGit(args, cwd, timeout) {
  try {
    return git(args, cwd, timeout);
  } catch {
    return null;
  }
}

function readPkg(dir) {
  try {
    return JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));
  } catch {
    return {};
  }
}

/** Public repo URL: Vercel env, else `origin`, else package.json `repository.url`. */
export function resolveRepoUrl({ cwd = root, env = process.env, pkg } = {}) {
  if (env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG) {
    return `https://github.com/${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}`;
  }
  const fromOrigin = normalizeRepoUrl(tryGit(["remote", "get-url", "origin"], cwd));
  if (fromOrigin) return fromOrigin;
  const repository = (pkg ?? readPkg(cwd)).repository;
  return normalizeRepoUrl(typeof repository === "string" ? repository : repository?.url);
}

function compareTags(a, b) {
  const pa = TAG_RE.exec(a).slice(1).map(Number);
  const pb = TAG_RE.exec(b).slice(1).map(Number);
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
}

function newestReachableTag(cwd) {
  const out = tryGit(["tag", "--merged", "HEAD", "--list", "v*"], cwd);
  if (!out) return null;
  const tags = out.split("\n").filter((t) => TAG_RE.test(t));
  return tags.length ? tags.sort(compareTags).pop() : null;
}

// Vercel clones with --depth=10 and no tags. The repo is public, so tags + full history can be
// fetched over https without credentials. Failure is fine: the caller falls back.
function ensureHistory(cwd, repoUrl) {
  const shallow = tryGit(["rev-parse", "--is-shallow-repository"], cwd) === "true";
  if (!shallow && newestReachableTag(cwd)) return;
  if (!repoUrl) return;
  const args = ["fetch", "--quiet", "--tags", "--force"];
  if (shallow) args.push("--unshallow");
  args.push(repoUrl);
  tryGit(args, cwd, FETCH_TIMEOUT_MS);
}

function listCommits(cwd, range) {
  const out = git(["log", "--no-merges", "--format=%H%x1f%s%x1f%b%x1e", range], cwd);
  return out
    .split("\x1e")
    .map((entry) => entry.replace(/^\n/, ""))
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body] = entry.split("\x1f");
      return { hash, subject: subject ?? "", body: body ?? "" };
    });
}

function fallbackResult({ pkg, sha, repo }) {
  const full = sha || "unknown";
  return {
    version: pkg.version ?? "0.0.0",
    sha: full,
    shortSha: full === "unknown" ? "unknown" : full.slice(0, 7),
    released: false,
    base: null,
    bump: null,
    repo,
    fallback: true,
  };
}

/**
 * Resolve the version for the checkout at `cwd`. Never throws: any failure yields the package.json
 * version plus the SHA, with `fallback: true`.
 *
 * `released` is true only when the version equals an existing tag (no releasable commits since it),
 * or on a Vercel production build (release.yml tags main moments later). A pending bump on a
 * PR/preview build is `released: false`, so no link to a tag that does not exist yet.
 * `bump` is the pending bump (null = none). `fetchUrl` overrides the URL used to fetch history.
 */
export function resolveVersion({ cwd = root, env = process.env, fetchUrl } = {}) {
  let pkg = {};
  let sha = env.VERCEL_GIT_COMMIT_SHA || "";
  let repo = null;
  try {
    pkg = readPkg(cwd);
    repo = resolveRepoUrl({ cwd, env, pkg });
    if (!sha) sha = tryGit(["rev-parse", "HEAD"], cwd) || "";
    ensureHistory(cwd, fetchUrl ?? repo);
    const base = newestReachableTag(cwd);
    if (!base) {
      // No tag reachable. Only a confirmed complete history makes this "simply unreleased";
      // a shallow clone or missing git means we cannot know.
      const complete = tryGit(["rev-parse", "--is-shallow-repository"], cwd) === "false";
      return { ...fallbackResult({ pkg, sha, repo }), fallback: !complete };
    }
    const commits = listCommits(cwd, `${base}..HEAD`);
    const bump = bumpFor(commits);
    const version = nextVersion(base, commits);
    return {
      version,
      sha: sha || "unknown",
      shortSha: sha ? sha.slice(0, 7) : "unknown",
      released: bump === null || env.VERCEL_ENV === "production",
      base: base.slice(1),
      bump,
      repo,
      fallback: false,
    };
  } catch {
    return fallbackResult({ pkg, sha, repo });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(resolveVersion(), null, 2));
}
