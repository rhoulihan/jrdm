import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { exit } from "node:process";

const SRC_RE = /^(packages|apps)\/[^/]+\/src\/(.+)\.tsx?$/;
const TEST_RE = /\.(test|spec)\.tsx?$/;
const INDEX_RE = /(^|\/)index\.tsx?$/;
const TESTED_BY_RE = /^\/\/\s*@tested-by:\s*(.+)$/m;

/**
 * @param {string[]} stagedFiles
 * @param {(path: string) => string} [readFile] - reads source file content; defaults to disk read
 */
export function checkTestPairs(stagedFiles, readFile) {
  const _read =
    readFile ??
    ((p) => {
      try {
        return readFileSync(p, "utf8");
      } catch {
        return "";
      }
    });

  const sources = stagedFiles.filter(
    (f) => SRC_RE.test(f) && !TEST_RE.test(f) && !INDEX_RE.test(f),
  );
  const tests = new Set(stagedFiles.filter((f) => TEST_RE.test(f)));
  const missing = sources.filter((src) => !hasTestPair(src, tests, _read));
  return { ok: missing.length === 0, missing };
}

function hasTestPair(srcPath, tests, readFile) {
  const m = srcPath.match(SRC_RE);
  const stem = m[2];

  // 1. Stem-based matching: foo.ts → foo.test.ts / foo.spec.ts / __tests__/foo.test.ts etc.
  for (const t of tests) {
    if (t.endsWith(`/${stem}.test.ts`) || t.endsWith(`/${stem}.test.tsx`)) return true;
    if (t.endsWith(`/${stem}.spec.ts`) || t.endsWith(`/${stem}.spec.tsx`)) return true;
  }

  // 2. Explicit escape hatch: // @tested-by: <path-relative-to-repo-root>
  //    The named test must also be in the staged set.
  const content = readFile(srcPath);
  const testedByMatch = content.match(TESTED_BY_RE);
  if (testedByMatch) {
    const annotatedPath = testedByMatch[1].trim();
    if (tests.has(annotatedPath)) return true;
  }

  return false;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const staged = execSync("git diff --cached --name-only --diff-filter=ACMR", {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  const { ok, missing } = checkTestPairs(staged);
  if (!ok) {
    console.error("❌ test-pair gate: staged source files without test pairs:");
    for (const f of missing) console.error(`   - ${f}`);
    console.error(
      "\nEach source file needs either:" +
        "\n  • a stem-matched test (foo.ts → foo.test.ts or __tests__/foo.test.ts)" +
        "\n  • an explicit annotation: // @tested-by: <path/to/covering.test.ts>" +
        "\n    (the named test must also be staged)" +
        "\n\nUse --no-verify only as a last resort and log the reason in tasks/lessons.md.",
    );
    exit(1);
  }
}
