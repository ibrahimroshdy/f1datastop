// Board check — node, no deps.
// Asserts f1datastop-design-board.html documents the tightened F1* kit:
// sections, size ladder, no Kept strings, token values match web/src/index.css.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const boardPath = join(root, "f1datastop-design-board.html");
const cssPath = join(root, "web", "src", "index.css");

const failures = [];
const ok = (cond, msg) => { if (!cond) failures.push(msg); };

if (!existsSync(boardPath)) {
  console.error("FAIL: board not found at f1datastop-design-board.html");
  process.exit(1);
}

const board = readFileSync(boardPath, "utf8");
const css = readFileSync(cssPath, "utf8");

// 1. Sections
for (const s of ["logo-use", "colour", "type", "motifs", "charts", "decisions"]) {
  ok(board.includes(s), `missing section: ${s}`);
}

// 2. Size ladder
for (const s of ["16 px", "32 px", "64 px", "192 px"]) {
  ok(board.includes(s), `missing size ladder entry: ${s}`);
}

// 3. No Kept strings
for (const s of ["#F0B03A", "Plex", "--amber", "--violet"]) {
  ok(!board.includes(s), `forbidden Kept string present: ${s}`);
}

// 4. Token values listed match index.css.
// For each checked var, every value assigned in index.css must appear verbatim in the board.
const vars = ["--primary", "--background", "--card", "--muted-foreground", "--fastest-lap", "--position-gold"];
for (const v of vars) {
  const re = new RegExp(`${v}\\s*:\\s*([^;]+);`, "g");
  const values = new Set();
  let m;
  while ((m = re.exec(css)) !== null) values.add(m[1].trim());
  ok(values.size > 0, `no values found in index.css for ${v}`);
  for (const val of values) {
    ok(board.includes(val), `board missing ${v} value "${val}" from index.css`);
  }
}

if (failures.length > 0) {
  console.error("FAIL: design board check failed:");
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("PASS: design board check");
