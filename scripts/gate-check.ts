#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  compareKnipFindings,
  extractKnipFingerprints,
  pruneKnipBaseline,
  type KnipReport,
} from "./internal/gate-checker";

const BASELINE_FILE = ".knip-baseline.json";
const isUpdateMode = process.argv.includes("--update-baseline");

console.log("🔍 Running Structural Quality Gates (Level L4)...");

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

let knipReport: KnipReport;
try {
  knipReport = JSON.parse(knipProc.stdout || "{}");
} catch (e) {
  console.error("Failed to parse knip JSON output:", e);
  console.error(knipProc.stdout || knipProc.stderr);
  process.exit(1);
}

const currentFingerprints = extractKnipFingerprints(knipReport);

if (isUpdateMode) {
  if (!existsSync(BASELINE_FILE)) {
    // Initial baseline creation
    writeFileSync(BASELINE_FILE, JSON.stringify(knipReport, null, 2), "utf-8");
    console.log(
      `\n✅ Initialized ${BASELINE_FILE} with ${currentFingerprints.size} items.`,
    );
    process.exit(0);
  }

  let baselineReport: KnipReport;
  try {
    baselineReport = JSON.parse(readFileSync(BASELINE_FILE, "utf-8"));
  } catch (e) {
    console.error(`Failed to read baseline file ${BASELINE_FILE}:`, e);
    process.exit(1);
  }

  const pruneResult = pruneKnipBaseline(knipReport, baselineReport);
  if (!pruneResult.success || !pruneResult.prunedReport) {
    console.error(
      `\n❌ Ratchet violation: Cannot update baseline while ${pruneResult.newViolations.length} new structural violation(s) exist:\n`,
    );
    for (const v of pruneResult.newViolations.slice(0, 25)) {
      console.error(`  • ${v}`);
    }
    if (pruneResult.newViolations.length > 25) {
      console.error(`  ...and ${pruneResult.newViolations.length - 25} more.`);
    }
    console.error(
      "\nBaseline updates may ONLY tighten the ratchet by pruning resolved findings. Fix new violations first.",
    );
    process.exit(1);
  }

  writeFileSync(
    BASELINE_FILE,
    JSON.stringify(pruneResult.prunedReport, null, 2),
    "utf-8",
  );
  console.log(
    `\n✅ Updated ${BASELINE_FILE}: pruned ${pruneResult.prunedCount} resolved items (total remaining: ${currentFingerprints.size}).`,
  );
  process.exit(0);
}

if (!existsSync(BASELINE_FILE)) {
  console.error(`\n❌ Knip baseline file not found: ${BASELINE_FILE}`);
  console.error("Run `bun run gate:update-baseline` to initialize baseline.");
  process.exit(1);
}

let baselineReport: KnipReport;
try {
  baselineReport = JSON.parse(readFileSync(BASELINE_FILE, "utf-8"));
} catch (e) {
  console.error(`Failed to read baseline file ${BASELINE_FILE}:`, e);
  process.exit(1);
}

const comparison = compareKnipFindings(knipReport, baselineReport);

if (comparison.resolvedCount > 0) {
  console.log(
    `\n🎉 Outstanding progress: ${comparison.resolvedCount} baseline structural issues have been resolved!`,
  );
  console.log(
    "Run `bun run gate:update-baseline` when ready to tighten the ratchet.",
  );
}

if (!comparison.passed) {
  console.error(
    `\n❌ Knip gate failed: ${comparison.newViolations.length} new structural violation(s) introduced:\n`,
  );
  for (const v of comparison.newViolations.slice(0, 25)) {
    console.error(`  • ${v}`);
  }
  if (comparison.newViolations.length > 25) {
    console.error(`  ...and ${comparison.newViolations.length - 25} more.`);
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
