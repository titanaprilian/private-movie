#!/usr/bin/env bun
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  generateCoverageReport,
  parseCliArgs,
  scanCoverageDirectory,
} from "./internal/coverage-reporter";

const cliOptions = parseCliArgs(process.argv.slice(2), process.env);
const currentDir = cliOptions.currentDir
  ? path.resolve(process.cwd(), cliOptions.currentDir)
  : process.cwd();

const currentSummaries = scanCoverageDirectory(currentDir);

let baseSummaries: ReturnType<typeof scanCoverageDirectory> | null = null;
let baseAvailable = false;

if (cliOptions.baseDir) {
  const baseDir = path.resolve(process.cwd(), cliOptions.baseDir);
  baseSummaries = scanCoverageDirectory(baseDir);
  baseAvailable = baseSummaries.size > 0;
}

const report = generateCoverageReport({
  currentSummaries,
  baseSummaries,
  baseAvailable,
});

console.log(report.markdown);

const outCoverageDir = path.join(currentDir, "coverage");
mkdirSync(outCoverageDir, { recursive: true });
writeFileSync(path.join(outCoverageDir, "summary.md"), report.markdown);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.markdown);
}
