#!/usr/bin/env bun
import {
  evaluateMigrations,
  resolveMigrationFilesToCheck,
} from "./internal/migration-checker";

function printUsageAndExit() {
  console.log(`
Usage: bun scripts/migration-lint.ts [options]

Options:
  --all            Check all migration files in packages/db/drizzle/
  --base <ref>     Base git reference to compare against (default: origin/main or main)
  -h, --help       Show this help message
`);
  process.exit(0);
}

const args = process.argv.slice(2);
let all = false;
let baseRef: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--all") {
    all = true;
  } else if (arg === "--base") {
    if (i + 1 < args.length) {
      baseRef = args[++i];
    } else {
      console.error("Error: --base requires a reference argument");
      process.exit(1);
    }
  } else if (arg.startsWith("--base=")) {
    baseRef = arg.slice("--base=".length);
  } else if (arg === "--help" || arg === "-h") {
    printUsageAndExit();
  } else {
    console.error(`Unknown option: ${arg}`);
    printUsageAndExit();
  }
}

console.log("🛡️ Running Migration Safety Lint...");

const filesToCheck = resolveMigrationFilesToCheck({ all, baseRef });

if (filesToCheck.length === 0) {
  console.log("✅ No migration files to check.");
  process.exit(0);
}

console.log(`Scanning ${filesToCheck.length} migration file(s)...`);
const result = evaluateMigrations(filesToCheck);

if (!result.passed) {
  console.error(
    `\n❌ Migration safety check failed: ${result.violations.length} destructive violation(s) detected:\n`,
  );
  for (const v of result.violations) {
    console.error(`  • ${v.file}:${v.line} [${v.rule}]`);
    console.error(`    Statement: ${v.statement}`);
    console.error(`    Remediation: ${v.remediation}\n`);
  }
  console.error(
    "Please follow the Expand-and-Contract protocol (packages/db/AGENTS.md) or use '-- allow-destructive: <rationale>' if dropping is verified safe.\n",
  );
  process.exit(1);
}

console.log(
  `\n✨ Migration safety check passed! (${result.scannedFiles.length} file(s) scanned, 0 violations)`,
);
process.exit(0);
