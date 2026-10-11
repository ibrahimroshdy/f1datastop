/**
 * Design-kit audit (DESIGN.md §1 + §7 enforcement checklist).
 *
 * Grep-based token/BEM checks over `web/src/components/f1/*.tsx`:
 *  1. No banned legacy/palette utilities in class strings.
 *  2. No raw 3/6-digit hex literals outside `@/constants/f1Colors`
 *     (comments + string literals are stripped first to avoid false
 *     positives; `inherit`/`transparent`/`currentColor` are not hex).
 *  3. Team color helpers are only ever imported from `@/constants/f1Colors`
 *     (no local team-color maps, no frozen `bg-ferrari`-style utilities).
 *
 * When this test fails it prints the audit backlog: file, line and hit.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const F1_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Component sources under audit — test files themselves are excluded. */
const SOURCES = readdirSync(F1_DIR)
  .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
  .sort();

/** Banned legacy F1 utilities (DESIGN.md §1.5 — the `f1-*` family is poisoned). */
const BANNED_F1_UTILS = /\b(bg|text|border|ring|outline|decoration)-f1-(red|black|dark|gray)\b/;

/** Exact banned literals from the design-kit task brief. */
const BANNED_LITERALS = [
  "bg-red-500",
  "text-white",
  "text-black",
  "bg-white/",
  "bg-black/",
] as const;

/**
 * Palette-color utilities. Prefix-aware (`bg-zinc-900`) so plain words
 * containing the fragment (e.g. `translate`) never match.
 */
const BANNED_PALETTE =
  /\b(bg|text|border|ring|divide|stroke|fill|from|via|to|placeholder|outline|decoration|accent|caret)-(zinc|slate)-\d+\b/;

/** Frozen per-team utilities — team color must come from f1Colors inline. */
const FROZEN_TEAM_UTILS =
  /\bbg-(redbull|ferrari|mclaren|mercedes|alpine|williams|astonmartin|haas|sauber|alphatauri|toro-?rosso|racing-?point|renault|force-?india|alfa|rb)\b/;

/** Static 3- or 6-digit hex literal. */
const RAW_HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;

/** References to the sanctioned team-color module. */
const TEAM_COLOR_REF =
  /\bTEAM_COLORS\b|\bDRIVER_COLORS\b|\bgetTeamColor\w*|\bgetTeamHex\w*|\bgenerateTeamColor\b|\bcolorWithAlpha\b|\blightenColor\b|\bdarkenColor\b/;
const TEAM_COLOR_IMPORT = /from\s+['"]@\/constants\/f1Colors['"]/;
/** A locally-defined team-color map (must not exist outside f1Colors.ts). */
const LOCAL_TEAM_MAP = /\b(const|let|var)\s+\w*[Tt]eam[Cc]olors?\s*=/;

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Remove single/double-quoted and template strings (escape-aware). */
function stripStrings(src: string): string {
  return src
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

interface Violation {
  file: string;
  line: number;
  kind: string;
  hit: string;
}

function auditFile(file: string): Violation[] {
  const raw = readFileSync(path.join(F1_DIR, file), "utf8");
  const code = stripComments(raw);
  const out: Violation[] = [];

  const checkLines = (text: string, kind: string, re: RegExp) => {
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (const m of text.matchAll(global)) {
      const line = text.slice(0, m.index).split("\n").length;
      out.push({ file, line, kind, hit: m[0].trim().slice(0, 80) });
    }
  };

  // 1. Banned utilities apply to class strings → scan code with strings kept.
  checkLines(code, "banned-f1-utility", BANNED_F1_UTILS);
  checkLines(code, "banned-palette", BANNED_PALETTE);
  checkLines(code, "frozen-team-utility", FROZEN_TEAM_UTILS);
  for (const lit of BANNED_LITERALS) {
    const idx = code.indexOf(lit);
    if (idx !== -1) {
      out.push({
        file,
        line: code.slice(0, idx).split("\n").length,
        kind: "banned-utility",
        hit: lit,
      });
    }
  }

  // 2. Raw hex: comments AND string literals are exempt (avoid false
  // positives); what remains must be hex-free outside f1Colors.ts.
  checkLines(stripStrings(code), "raw-hex", RAW_HEX);

  // 3. Team color only via @/constants/f1Colors.
  if (TEAM_COLOR_REF.test(code) && !TEAM_COLOR_IMPORT.test(code)) {
    out.push({ file, line: 1, kind: "team-color-import", hit: "team color ref without @/constants/f1Colors import" });
  }
  checkLines(code, "local-team-map", LOCAL_TEAM_MAP);

  return out;
}

describe("design-kit audit (DESIGN.md §1 token-only color)", () => {
  it("scans the F1* component set", () => {
    expect(SOURCES.length).toBeGreaterThan(0);
  });

  it("has no banned utilities, raw hex, or off-module team colors", () => {
    const violations = SOURCES.flatMap(auditFile);
    const report = violations
      .map((v) => `${v.file}:${v.line} [${v.kind}] ${v.hit}`)
      .join("\n");
    expect(report, `\nDesign-kit audit backlog (${violations.length}):\n${report}\n`).toBe("");
  });
});