#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { evaluateKnipFindings, type KnipReport } from "./internal/gate-checker";

console.log("🔍 Running Structural Quality Gates (Level L5 Zero-Tolerance)...");

// 1. Run JSCPD Check
console.log("\n📦 [1/2] Checking Code Duplication (jscpd)...");
const jscpdResult = spawnSync("bunx", ["jscpd", "--config", ".jscpd.json"], {
  encoding: "utf-8",
  env: process.env,
  maxBuffer: 20 * 1024 * 1024,
});

if (jscpdResult.status !== 0) {
  console.error(jscpdResult.stdout || jscpdResult.stderr);
  console.error(
    "\n❌ JSCPD gate failed: code duplication exceeded calibrated threshold (1.5%).",
  );
  process.exit(jscpdResult.status ?? 1);
} else {
  // If clean, extract and print summary table lines from jscpd output
  const lines = (jscpdResult.stdout || "").split("\n");
  const tableStartIndex = lines.findIndex((l) => l.startsWith("┌"));
  const tableEndIndex = lines.findIndex((l) => l.startsWith("└"));
  if (tableStartIndex !== -1 && tableEndIndex !== -1) {
    console.log(lines.slice(tableStartIndex, tableEndIndex + 2).join("\n"));
  } else {
    console.log("✅ Code duplication within acceptable limits.");
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

const evaluation = evaluateKnipFindings(knipReport);

if (!evaluation.passed) {
  console.error(
    `\n❌ Knip gate failed: ${evaluation.violations.length} structural violation(s) detected:\n`,
  );
  for (const v of evaluation.violations.slice(0, 25)) {
    console.error(`  • ${v}`);
  }
  if (evaluation.violations.length > 25) {
    console.error(`  ...and ${evaluation.violations.length - 25} more.`);
  }
  console.error(
    "\nPlease eliminate unused exports/dependencies before pushing, or report if legitimate public API.",
  );
  process.exit(1);
}

console.log(
  `\n✨ Quality Gate Check Passed! (Level L5 Zero-Tolerance: 0 unused items, duplication within threshold)`,
);
process.exit(0);
