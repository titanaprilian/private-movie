#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  checkComplexityHotspots,
  evaluateDuplicationDelta,
  evaluateKnipProcess,
  formatDuplicationFinding,
  formatGitHubAnnotation,
  formatGitHubDuplicationAnnotation,
  formatKnipFinding,
  getTouchedFilesAgainstBase,
  resolveMergeBase,
  type JscpdReport,
} from "./internal/gate-checker";
import {
  evaluateMigrations,
  resolveMigrationFilesToCheck,
} from "./internal/migration-checker";

console.log(
  "🔍 Running Structural Quality Gates (Regression-Aware Level L5)...",
);

// 0. Base resolution
const mergeBase = resolveMergeBase();
let currentHead = "";
try {
  currentHead =
    spawnSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf-8",
    }).stdout?.trim() || "";
} catch {}

const isDiffRun = Boolean(
  mergeBase && currentHead && mergeBase !== currentHead,
);
const touchedFiles =
  isDiffRun && mergeBase ? getTouchedFilesAgainstBase(mergeBase) : [];

if (isDiffRun && mergeBase) {
  console.log(
    `🔗 PR Merge-Base: ${mergeBase.slice(0, 8)} (${touchedFiles.length} file(s) changed relative to base)`,
  );
} else {
  console.log(
    "🔗 PR Merge-Base: Clean / Head state (evaluating absolute constraints)",
  );
}

// 1. Run JSCPD Check (Differential)
console.log("\n📦 [1/4] Checking Code Duplication (jscpd differential)...");
const headOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "jscpd-head-"));
let headReport: JscpdReport = {};

try {
  const jscpdHead = spawnSync(
    "bunx",
    [
      "jscpd",
      "--config",
      ".jscpd.json",
      "--reporters",
      "json",
      "--output",
      headOutDir,
    ],
    { encoding: "utf-8", env: process.env, maxBuffer: 20 * 1024 * 1024 },
  );

  const headJsonPath = path.join(headOutDir, "jscpd-report.json");
  if (fs.existsSync(headJsonPath)) {
    headReport = JSON.parse(fs.readFileSync(headJsonPath, "utf-8"));
  } else if (jscpdHead.status !== 0) {
    console.error(jscpdHead.stdout || jscpdHead.stderr);
    console.error("\n❌ JSCPD failed to produce duplication report.");
    process.exit(1);
  }
} finally {
  fs.rmSync(headOutDir, { recursive: true, force: true });
}

let baseReport: JscpdReport | null = null;
if (isDiffRun && mergeBase) {
  const baseWtDir = fs.mkdtempSync(path.join(os.tmpdir(), "jscpd-base-wt-"));
  const baseOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "jscpd-base-out-"));

  try {
    const wtAdd = spawnSync(
      "git",
      ["worktree", "add", "--detach", baseWtDir, mergeBase],
      {
        encoding: "utf-8",
      },
    );
    if (wtAdd.status === 0) {
      spawnSync(
        "bunx",
        [
          "jscpd",
          "--config",
          path.resolve(".jscpd.json"),
          "--reporters",
          "json",
          "--output",
          baseOutDir,
        ],
        {
          cwd: baseWtDir,
          encoding: "utf-8",
          env: process.env,
          maxBuffer: 20 * 1024 * 1024,
        },
      );
      const baseJsonPath = path.join(baseOutDir, "jscpd-report.json");
      if (fs.existsSync(baseJsonPath)) {
        baseReport = JSON.parse(fs.readFileSync(baseJsonPath, "utf-8"));
      }
    }
  } catch (err) {
    console.warn(
      `⚠️ Warning: Failed to generate base duplication report: ${err}`,
    );
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", baseWtDir], {
      encoding: "utf-8",
    });
    fs.rmSync(baseWtDir, { recursive: true, force: true });
    fs.rmSync(baseOutDir, { recursive: true, force: true });
  }
}

const dupResult = evaluateDuplicationDelta({
  headReport,
  baseReport,
  touchedFiles,
  maxAbsoluteThreshold: 1.5,
});

if (!dupResult.passed) {
  console.error(
    `\n❌ JSCPD gate failed: ${dupResult.violations.length} duplication violation(s):\n`,
  );
  for (const v of dupResult.violations) {
    console.error(`  • ${v}`);
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    for (const clone of dupResult.newClones) {
      const annotation = formatGitHubDuplicationAnnotation(clone);
      if (annotation) console.error(annotation);
    }
  }

  process.exit(1);
} else {
  const headPct = dupResult.currentPercentage.toFixed(2);
  if (baseReport && dupResult.basePercentage != null) {
    const basePct = dupResult.basePercentage.toFixed(2);
    console.log(
      `✅ Code duplication non-regression verified (${headPct}% vs base ${basePct}%, 0 new clone blocks).`,
    );
  } else {
    console.log(
      `✅ Code duplication within acceptable limits (${headPct}% <= 1.5%).`,
    );
  }
}

// 2. Run Complexity Hotspots Check
console.log("\n⚡ [2/4] Checking Cyclomatic Complexity Hotspots...");
const complexityResult = checkComplexityHotspots({ touchedFiles });

if (!complexityResult.passed) {
  console.error(
    `\n❌ Complexity gate failed: ${complexityResult.violations.length} hotspot regression(s) detected:\n`,
  );
  for (const v of complexityResult.violations) {
    console.error(`  • ${v}`);
    if (process.env.GITHUB_ACTIONS === "true") {
      const [file, ...rest] = v.split(" ");
      console.error(
        `::error file=${file},title=Complexity Regression::${rest.join(" ")}`,
      );
    }
  }
  process.exit(1);
} else {
  console.log(
    "✅ No cyclomatic complexity regressions detected in legacy hotspots.",
  );
}

// 3. Run Knip Check
console.log("\n🧹 [3/4] Checking Unused Dependencies & Exports (knip)...");

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
        if (annotation) console.error(annotation);
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

// 4. Run Migration Safety Check
console.log("\n🛡️ [4/4] Checking Migration Safety (drizzle)...");
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
  `\n✨ Quality Gate Check Passed! (Level L5 Regression-Aware: 0 unused items, duplication non-regression, complexity capped, migrations safe)`,
);
process.exit(0);
