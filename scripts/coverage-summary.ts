#!/usr/bin/env bun
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

type Metric = { pct: number };
type Summary = {
  total: Record<"lines" | "branches" | "functions" | "statements", Metric>;
};

const roots = ["apps", "packages"];
const rows: string[] = [];

for (const root of roots) {
  let entries: string[] = [];
  try {
    entries = await Array.fromAsync(
      new Bun.Glob(`${root}/*`).scan({ onlyFiles: false }),
    );
  } catch {
    continue;
  }
  for (const dir of entries.sort()) {
    const file = path.join(dir, "coverage", "coverage-summary.json");
    if (!existsSync(file)) continue;
    const { total } = JSON.parse(readFileSync(file, "utf8")) as Summary;
    rows.push(
      `| \`${dir}\` | ${total.lines.pct}% | ${total.branches.pct}% | ${total.functions.pct}% | ${total.statements.pct}% |`,
    );
  }
}

const table = [
  "### Coverage",
  "",
  "| Package | Lines | Branches | Functions | Statements |",
  "| --- | --- | --- | --- | --- |",
  ...(rows.length > 0 ? rows : ["| _no reports produced_ | | | | |"]),
  "",
].join("\n");

console.log(table);
mkdirSync("coverage", { recursive: true });
writeFileSync(path.join("coverage", "summary.md"), table);

if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
