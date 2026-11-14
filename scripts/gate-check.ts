#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const BASELINE_FILE = ".knip-baseline.json";
const isUpdateMode = process.argv.includes("--update-baseline");

console.log("🔍 Running Structural Quality Gates (Level L3)...");

// 1. Run JSCPD Check
console.log("\n📦 [1/2] Checking Code Duplication (jscpd)...");
const jscpdArgs = isUpdateMode
  ? ["jscpd", "--config", ".jscpd.json", "--update-baseline"]
  : ["jscpd", "--config", ".jscpd.json"];

const jscpdResult = spawnSync("bunx", jscpdArgs, {
  encoding: "utf-8",
  env: process.env,
  maxBuffer: 20 * 1024 * 1024,
});

if (jscpdResult.status !== 0) {
  console.error(jscpdResult.stdout || jscpdResult.stderr);
  console.error("\n❌ JSCPD gate failed: new code duplication detected.");
  console.error(
    "Please refactor duplicated logic into shared helpers or update the baseline if authorized.",
  );
  process.exit(jscpdResult.status ?? 1);
} else {
  // If clean, extract and print just the summary table lines from jscpd output
  const lines = (jscpdResult.stdout || "").split("\n");
  const tableStartIndex = lines.findIndex((l) => l.startsWith("┌"));
  const tableEndIndex = lines.findIndex((l) => l.startsWith("└"));
  if (tableStartIndex !== -1 && tableEndIndex !== -1) {
    console.log(lines.slice(tableStartIndex, tableEndIndex + 2).join("\n"));
  } else {
    console.log("✅ No new duplication detected.");
  }
}

// 2. Run Knip Check
console.log("\n🧹 [2/2] Checking Unused Dependencies & Exports (knip)...");

const knipProc = spawnSync("bunx", ["knip", "--reporter", "json"], {
  encoding: "utf-8",
  env: process.env,
  maxBuffer: 50 * 1024 * 1024,
});

let knipReport: { issues: Array<Record<string, unknown>> };
try {
  knipReport = JSON.parse(knipProc.stdout || "{}");
} catch (e) {
  console.error("Failed to parse knip JSON output:", e);
  console.error(knipProc.stdout || knipProc.stderr);
  process.exit(1);
}

interface IssueItem {
  name: string;
}

function extractFingerprints(report: {
  issues: Array<Record<string, unknown>>;
}): Set<string> {
  const set = new Set<string>();
  const categories = [
    "files",
    "dependencies",
    "devDependencies",
    "unlisted",
    "unresolved",
    "exports",
    "types",
    "enumMembers",
    "duplicates",
  ];

  for (const item of report.issues || []) {
    const file = String(item.file || "");
    for (const cat of categories) {
      const arr = item[cat];
      if (Array.isArray(arr)) {
        for (const entry of arr) {
          if (Array.isArray(entry)) {
            const names = entry.map((x: IssueItem) => x?.name).join("|");
            set.add(`${file}:${cat}:${names}`);
          } else if (entry && typeof entry === "object" && "name" in entry) {
            set.add(`${file}:${cat}:${(entry as IssueItem).name}`);
          } else {
            set.add(`${file}:${cat}:${JSON.stringify(entry)}`);
          }
        }
      }
    }
  }
  return set;
}

const currentFingerprints = extractFingerprints(knipReport);

if (isUpdateMode) {
  writeFileSync(BASELINE_FILE, JSON.stringify(knipReport, null, 2), "utf-8");
  console.log(
    `\n✅ Updated ${BASELINE_FILE} with ${currentFingerprints.size} items.`,
  );
  process.exit(0);
}

if (!existsSync(BASELINE_FILE)) {
  console.error(`\n❌ Knip baseline file not found: ${BASELINE_FILE}`);
  console.error("Run `bun run gate:update-baseline` to initialize baseline.");
  process.exit(1);
}

let baselineReport: { issues: Array<Record<string, unknown>> };
try {
  baselineReport = JSON.parse(readFileSync(BASELINE_FILE, "utf-8"));
} catch (e) {
  console.error(`Failed to read baseline file ${BASELINE_FILE}:`, e);
  process.exit(1);
}

const baselineFingerprints = extractFingerprints(baselineReport);
const newViolations: string[] = [];

for (const fp of currentFingerprints) {
  if (!baselineFingerprints.has(fp)) {
    newViolations.push(fp);
  }
}

let resolvedCount = 0;
for (const fp of baselineFingerprints) {
  if (!currentFingerprints.has(fp)) {
    resolvedCount++;
  }
}

if (resolvedCount > 0) {
  console.log(
    `\n🎉 Outstanding progress: ${resolvedCount} baseline structural issues have been resolved!`,
  );
  console.log(
    "Run `bun run gate:update-baseline` when ready to tighten the ratchet.",
  );
}

if (newViolations.length > 0) {
  console.error(
    `\n❌ Knip gate failed: ${newViolations.length} new structural violation(s) introduced:\n`,
  );
  for (const v of newViolations.slice(0, 25)) {
    console.error(`  • ${v}`);
  }
  if (newViolations.length > 25) {
    console.error(`  ...and ${newViolations.length - 25} more.`);
  }
  console.error(
    "\nPlease eliminate unused exports/dependencies before pushing, or report if legitimate public API.",
  );
  process.exit(1);
}

console.log(
  `\n✨ Quality Gate Check Passed! (0 new duplications, 0 new unused exports/dependencies)`,
);
process.exit(0);
