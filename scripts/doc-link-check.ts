#!/usr/bin/env bun
import path from "node:path";
import { checkAllDocs } from "./internal/doc-link-checker";

console.log("🔗 Checking Documentation Links & Anchors...");

const rootDir = process.cwd();
const specificFiles = process.argv
  .slice(2)
  .map((f) => path.resolve(rootDir, f));

const result = checkAllDocs(
  rootDir,
  specificFiles.length > 0 ? specificFiles : undefined,
);

if (!result.passed) {
  console.error(
    `\n❌ Documentation link check failed: ${result.violations.length} broken link/anchor violation(s) detected:\n`,
  );
  for (const v of result.violations) {
    const relFile = path.relative(rootDir, v.file);
    console.error(`  • ${relFile}:${v.line} -> "${v.target}" (${v.reason})`);
    if (v.details) {
      console.error(`    ${v.details}`);
    }
  }
  console.error(
    "\nPlease resolve or update broken documentation links before pushing.\n",
  );
  process.exit(1);
}

console.log(
  `\n✨ Documentation Check Passed! (${result.totalFiles} files, ${result.totalLinks} links verified, 0 broken links/anchors)\n`,
);
process.exit(0);
