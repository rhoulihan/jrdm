import { execSync } from "node:child_process";
import { exit } from "node:process";

const SRC_RE = /^(packages|apps)\/[^/]+\/src\/(.+)\.tsx?$/;
const TEST_RE = /\.(test|spec)\.tsx?$/;
const INDEX_RE = /(^|\/)index\.tsx?$/;

export function checkTestPairs(stagedFiles) {
  const sources = stagedFiles.filter(
    (f) => SRC_RE.test(f) && !TEST_RE.test(f) && !INDEX_RE.test(f),
  );
  const tests = new Set(stagedFiles.filter((f) => TEST_RE.test(f)));
  const missing = sources.filter((src) => !hasTestPair(src, tests));
  return { ok: missing.length === 0, missing };
}

function hasTestPair(srcPath, tests) {
  const m = srcPath.match(SRC_RE);
  const stem = m[2];
  for (const t of tests) {
    if (t.endsWith(`/${stem}.test.ts`) || t.endsWith(`/${stem}.test.tsx`)) return true;
    if (t.endsWith(`/${stem}.spec.ts`) || t.endsWith(`/${stem}.spec.tsx`)) return true;
    if (t.includes("/__tests__/") && t.includes(stem.split("/").pop())) return true;
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
      "\nAdd a matching test file (same name, .test.ts or in __tests__/), or use --no-verify and log the reason in tasks/lessons.md.",
    );
    exit(1);
  }
}
