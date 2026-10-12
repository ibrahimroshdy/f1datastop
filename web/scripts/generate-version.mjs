// Writes dist/version.json so every deployment self-reports its version + commit.
// Runs as `postbuild`. Resolution lives in scripts/semver.mjs (shared with vite.config.ts).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVersion } from "./semver.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const info = resolveVersion({ cwd: root });

const distDir = resolve(root, "dist");
mkdirSync(distDir, { recursive: true });

const payload = {
  name: pkg.name ?? "f1datastop-web",
  version: info.version,
  sha: info.sha,
  shortSha: info.shortSha,
  builtAt: new Date().toISOString(),
  repo: info.repo,
  released: info.released,
};

writeFileSync(resolve(distDir, "version.json"), JSON.stringify(payload, null, 2) + "\n");
console.log(
  `generate-version: ${payload.version} (${payload.shortSha})${info.fallback ? " [fallback]" : ""}`,
);
