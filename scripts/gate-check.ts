#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import {
  evaluateKnipProcess,
  formatGitHubAnnotation,
  formatKnipFinding,
} from "./internal/gate-checker";
import {
  evaluateMigrations,
  resolveMigrationFilesToCheck,
} from "./internal/migration-checker";

console.log("🔍 Running Structural Quality Gates (Level L5 Zero-Tolerance)...");

// 1. Run JSCPD Check
console.log("\n📦 [1/3] Checking Code Duplication (jscpd)...");
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
console.log("\n🧹 [2/3] Checking Unused Dependencies & Exports (knip)...");

const knipProc = spawnSync("bunx", ["knip", "--reporter", "json"], {
  encoding: "utf-8",
  env: process.env,
  maxBuffer: 50 * 1024 * 1024,
});

const knipResult = evaluateKnipProcess({
  status: knipProc.status,
  stdout: knipProc.stdout,
  stderr: knipProc.stderr,
  error: knipProc.error,
});

if (!knipResult.passed) {
  if (knipResult.processError) {
    console.error(
      `\n❌ Knip process execution error: ${knipResult.processError}`,
    );
  }

  if (knipResult.findings.length > 0) {
    console.error(
      `\n❌ Knip gate failed: ${knipResult.findings.length} structural violation(s) detected:\n`,
    );
    for (const f of knipResult.findings.slice(0, 25)) {
      console.error(`  • ${formatKnipFinding(f)}`);
    }
    if (knipResult.findings.length > 25) {
      console.error(`  ...and ${knipResult.findings.length - 25} more.`);
    }

    if (process.env.GITHUB_ACTIONS === "true") {
      for (const f of knipResult.findings) {
        const annotation = formatGitHubAnnotation(f);
        if (annotation) {
          console.error(annotation);
        }
      }
    }

    console.error(
      "\nPlease eliminate unused exports/dependencies before pushing, or report if legitimate public API.",
    );
  }

  process.exit(knipProc.status && knipProc.status !== 0 ? knipProc.status : 1);
} else {
  console.log("✅ No unused exports or dependencies detected.");
}

// 3. Run Migration Safety Check
console.log("\n🛡️ [3/3] Checking Migration Safety (drizzle)...");
const migrationFiles = resolveMigrationFilesToCheck();
const migrationResult = evaluateMigrations(migrationFiles);

if (!migrationResult.passed) {
  console.error(
    `\n❌ Migration safety gate failed: ${migrationResult.violations.length} destructive violation(s) detected:\n`,
  );
  for (const v of migrationResult.violations) {
    console.error(`  • ${v.file}:${v.line} [${v.rule}]`);
    console.error(`    Statement: ${v.statement}`);
    console.error(`    Remediation: ${v.remediation}\n`);
  }
  console.error(
    "Please follow the Expand-and-Contract protocol (packages/db/AGENTS.md) or use '-- allow-destructive: <rationale>' if authorized.\n",
  );
  process.exit(1);
} else {
  if (migrationResult.scannedFiles.length === 0) {
    console.log("✅ No new/modified migrations to check.");
  } else {
    console.log(
      `✅ ${migrationResult.scannedFiles.length} migration file(s) checked. No destructive operations detected.`,
    );
  }
}

console.log(
  `\n✨ Quality Gate Check Passed! (Level L5 Zero-Tolerance: 0 unused items, duplication within threshold, migrations safe)`,
);
process.exit(0);
