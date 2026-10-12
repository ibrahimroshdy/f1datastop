export interface CommitInfo {
  subject: string;
  body?: string;
}

export type Bump = "major" | "minor" | "patch" | null;

export interface VersionInfo {
  version: string;
  sha: string;
  shortSha: string;
  /** True only when `version` equals an existing release tag (no pending bump) or this is a Vercel production build; false for a pending bump on PR/preview builds and for fallbacks. */
  released: boolean;
  base: string | null;
  bump: Bump;
  repo: string | null;
  fallback: boolean;
}

export function commitBump(commit: CommitInfo): Bump;
export function bumpFor(commits: CommitInfo[]): Bump;
export function nextVersion(lastVersion: string, commits: CommitInfo[]): string;
export function normalizeRepoUrl(raw: string | null | undefined): string | null;
export function resolveRepoUrl(options?: {
  cwd?: string;
  env?: Record<string, string | undefined>;
  pkg?: unknown;
}): string | null;
export function resolveVersion(options?: {
  cwd?: string;
  env?: Record<string, string | undefined>;
  /** Overrides the URL history/tags are fetched from (tests). */
  fetchUrl?: string;
}): VersionInfo;
