import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export const KNIP_CATEGORIES = [
  "files",
  "dependencies",
  "devDependencies",
  "unlisted",
  "unresolved",
  "exports",
  "types",
  "enumMembers",
  "duplicates",
] as const;

export type KnipCategory = (typeof KNIP_CATEGORIES)[number];

export interface KnipIssueItem {
  name?: string;
  line?: number;
  col?: number;
  [key: string]: unknown;
}

export interface KnipFileIssue {
  file: string;
  [key: string]: unknown;
}

export interface KnipReport {
  issues?: KnipFileIssue[];
  [key: string]: unknown;
}

export interface KnipFinding {
  file: string;
  category: KnipCategory | string;
  name: string;
  line?: number;
  col?: number;
  fingerprint: string;
}

export interface GateEvaluationResult {
  passed: boolean;
  violations: string[];
  findings?: KnipFinding[];
}

export interface KnipExecutionResult {
  status: number | null;
  stdout?: string | null;
  stderr?: string | null;
  error?: Error | null;
}

export interface KnipGateResult {
  passed: boolean;
  processError: string | null;
  violations: string[];
  findings: KnipFinding[];
}

export function computeEntryFingerprint(
  file: string,
  cat: string,
  entry: unknown,
): string {
  if (Array.isArray(entry)) {
    const names = entry.map((x: KnipIssueItem) => x?.name).join("|");
    return `${file}:${cat}:${names}`;
  } else if (entry && typeof entry === "object" && "name" in entry) {
    return `${file}:${cat}:${(entry as KnipIssueItem).name}`;
  } else {
    return `${file}:${cat}:${JSON.stringify(entry)}`;
  }
}

export function extractKnipFingerprints(report: KnipReport): Set<string> {
  const set = new Set<string>();

  for (const item of report.issues || []) {
    const file = String(item.file || "");
    for (const cat of KNIP_CATEGORIES) {
      const arr = item[cat];
      if (Array.isArray(arr)) {
        for (const entry of arr) {
          set.add(computeEntryFingerprint(file, cat, entry));
        }
      }
    }
  }

  return set;
}

export function extractKnipFindings(report: KnipReport): KnipFinding[] {
  const findings: KnipFinding[] = [];
  const seen = new Set<string>();

  for (const item of report.issues || []) {
    const file = String(item.file || "");
    for (const cat of KNIP_CATEGORIES) {
      const arr = item[cat];
      if (!Array.isArray(arr)) continue;

      for (const entry of arr) {
        if (Array.isArray(entry)) {
          for (const sub of entry) {
            const subObj = sub as KnipIssueItem;
            const name =
              subObj?.name !== undefined
                ? String(subObj.name)
                : typeof sub === "string"
                  ? sub
                  : JSON.stringify(sub);
            const line =
              typeof subObj?.line === "number" && subObj.line > 0
                ? subObj.line
                : undefined;
            const col =
              typeof subObj?.col === "number" && subObj.col > 0
                ? subObj.col
                : undefined;
            const fingerprint = computeEntryFingerprint(file, cat, sub);
            const key = `${fingerprint}:${line ?? ""}:${col ?? ""}`;
            if (!seen.has(key)) {
              seen.add(key);
              findings.push({
                file,
                category: cat,
                name,
                line,
                col,
                fingerprint,
              });
            }
          }
        } else if (entry && typeof entry === "object") {
          const itemObj = entry as KnipIssueItem;
          const name =
            itemObj.name !== undefined
              ? String(itemObj.name)
              : JSON.stringify(entry);
          const line =
            typeof itemObj.line === "number" && itemObj.line > 0
              ? itemObj.line
              : undefined;
          const col =
            typeof itemObj.col === "number" && itemObj.col > 0
              ? itemObj.col
              : undefined;
          const fingerprint = computeEntryFingerprint(file, cat, entry);
          const key = `${fingerprint}:${line ?? ""}:${col ?? ""}`;
          if (!seen.has(key)) {
            seen.add(key);
            findings.push({
              file,
              category: cat,
              name,
              line,
              col,
              fingerprint,
            });
          }
        } else {
          const name = String(entry);
          const fingerprint = computeEntryFingerprint(file, cat, entry);
          const key = `${fingerprint}::`;
          if (!seen.has(key)) {
            seen.add(key);
            findings.push({
              file,
              category: cat,
              name,
              fingerprint,
            });
          }
        }
      }
    }
  }

  return findings;
}

export function formatKnipFinding(finding: KnipFinding): string {
  if (finding.line != null) {
    const colPart = finding.col != null ? `:${finding.col}` : "";
    return `${finding.file}:${finding.line}${colPart} [${finding.category}] ${finding.name}`;
  }
  return `${finding.file} [${finding.category}] ${finding.name}`;
}

export function formatGitHubAnnotation(
  finding: KnipFinding,
  level: "error" | "warning" = "error",
): string | null {
  if (!finding.file || typeof finding.line !== "number" || finding.line <= 0) {
    return null;
  }
  const parts = [`file=${finding.file}`, `line=${finding.line}`];
  if (typeof finding.col === "number" && finding.col > 0) {
    parts.push(`col=${finding.col}`);
  }
  parts.push(`title=Knip [${finding.category}]`);
  return `::${level} ${parts.join(",")}::Unused ${finding.category.replace(/s$/, "")}: ${finding.name}`;
}

export function evaluateKnipFindings(report: KnipReport): GateEvaluationResult {
  const fingerprints = extractKnipFingerprints(report);
  const violations = Array.from(fingerprints);
  const findings = extractKnipFindings(report);

  return {
    passed: violations.length === 0,
    violations,
    findings,
  };
}

export function evaluateKnipProcess(proc: KnipExecutionResult): KnipGateResult {
  if (proc.error) {
    return {
      passed: false,
      processError: `Knip process failed to execute: ${proc.error.message || String(proc.error)}`,
      violations: [],
      findings: [],
    };
  }

  let report: KnipReport = {};
  if (proc.stdout && proc.stdout.trim().length > 0) {
    try {
      report = JSON.parse(proc.stdout.trim());
    } catch (e) {
      return {
        passed: false,
        processError: `Failed to parse knip JSON output: ${e instanceof Error ? e.message : String(e)}`,
        violations: [],
        findings: [],
      };
    }
  }

  const evaluation = evaluateKnipFindings(report);
  const hasViolations = evaluation.violations.length > 0;
  const exitCode = proc.status;

  if (exitCode !== 0 && exitCode !== null) {
    if (exitCode === 1 && hasViolations) {
      return {
        passed: false,
        processError: null,
        violations: evaluation.violations,
        findings: evaluation.findings ?? [],
      };
    }

    const errorDetails = proc.stderr?.trim() ? ` (${proc.stderr.trim()})` : "";
    const processError = hasViolations
      ? `Knip process exited with error status ${exitCode}${errorDetails}`
      : `Knip process failed with exit code ${exitCode}${errorDetails}`;

    return {
      passed: false,
      processError,
      violations: evaluation.violations,
      findings: evaluation.findings ?? [],
    };
  }

  if (exitCode === null) {
    return {
      passed: false,
      processError: "Knip process terminated abnormally (killed by signal)",
      violations: evaluation.violations,
      findings: evaluation.findings ?? [],
    };
  }

  return {
    passed: evaluation.passed,
    processError: null,
    violations: evaluation.violations,
    findings: evaluation.findings ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge-Base Resolution (Level L3/L5 Differential Gate)
// ─────────────────────────────────────────────────────────────────────────────

export interface MergeBaseOptions {
  baseRef?: string;
  headRef?: string;
  cwd?: string;
}

export function resolveMergeBase(options?: MergeBaseOptions): string | null {
  const cwd = options?.cwd || process.cwd();
  const head = options?.headRef || "HEAD";

  const candidates: string[] = [];
  if (options?.baseRef) {
    candidates.push(options.baseRef);
    if (!options.baseRef.startsWith("origin/")) {
      candidates.push(`origin/${options.baseRef}`);
    }
  } else {
    if (process.env.BASE_REF) candidates.push(process.env.BASE_REF);
    if (process.env.GITHUB_BASE_REF) {
      candidates.push(`origin/${process.env.GITHUB_BASE_REF}`);
      candidates.push(process.env.GITHUB_BASE_REF);
    }
    candidates.push("origin/main", "main");
  }

  for (const base of candidates) {
    try {
      const res = spawnSync("git", ["merge-base", base, head], {
        cwd,
        encoding: "utf-8",
      });
      if (res.status === 0 && res.stdout) {
        const trimmed = res.stdout.trim();
        if (/^[0-9a-f]{40}$/.test(trimmed)) {
          return trimmed;
        }
      }
    } catch {}
  }

  return null;
}

export function getTouchedFilesAgainstBase(
  baseRef: string,
  cwd?: string,
): string[] {
  const repoCwd = cwd || process.cwd();
  try {
    const res = spawnSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", `${baseRef}...HEAD`],
      { cwd: repoCwd, encoding: "utf-8" },
    );
    if (res.status === 0 && res.stdout) {
      return res.stdout
        .split("\n")
        .map((f) => f.trim().replace(/\\/g, "/"))
        .filter(Boolean);
    }
  } catch {}
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Duplication (JSCPD) Differential Check
// ─────────────────────────────────────────────────────────────────────────────

export interface JscpdLoc {
  line: number;
  column: number;
}

export interface JscpdFileRef {
  name: string;
  startLoc?: JscpdLoc;
  endLoc?: JscpdLoc;
}

export interface JscpdClone {
  firstFile: JscpdFileRef;
  secondFile: JscpdFileRef;
  lines: number;
  tokens: number;
  format?: string;
  fragment?: string;
}

export interface JscpdReport {
  duplicates?: JscpdClone[];
  statistics?: {
    total?: {
      clones?: number;
      percentage?: number;
      duplicatedLines?: number;
      lines?: number;
    };
  };
}

export interface DuplicationFinding {
  file1: string;
  line1?: number;
  file2: string;
  line2?: number;
  lines: number;
  tokens: number;
  fingerprint: string;
  isNew: boolean;
}

export interface DuplicationGateResult {
  passed: boolean;
  violations: string[];
  findings: DuplicationFinding[];
  newClones: DuplicationFinding[];
  currentPercentage: number;
  basePercentage?: number;
}

export function computeCloneFingerprint(clone: JscpdClone): string {
  const fileA = (clone.firstFile.name || "").replace(/\\/g, "/");
  const fileB = (clone.secondFile.name || "").replace(/\\/g, "/");
  const [f1, f2] = fileA < fileB ? [fileA, fileB] : [fileB, fileA];

  const normFragment = (clone.fragment || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  const hash = createHash("sha256")
    .update(normFragment)
    .digest("hex")
    .slice(0, 16);

  return `${f1}<=>${f2}:${clone.tokens ?? 0}tok:${hash}`;
}

export function extractDuplicationFindings(
  headReport: JscpdReport,
  baseReport?: JscpdReport | null,
): DuplicationFinding[] {
  const baseFingerprints = new Set<string>();
  if (baseReport?.duplicates) {
    for (const d of baseReport.duplicates) {
      baseFingerprints.add(computeCloneFingerprint(d));
    }
  }

  const findings: DuplicationFinding[] = [];
  for (const clone of headReport.duplicates || []) {
    const fp = computeCloneFingerprint(clone);
    const isNew = baseReport ? !baseFingerprints.has(fp) : true;
    const file1 = (clone.firstFile.name || "").replace(/\\/g, "/");
    const file2 = (clone.secondFile.name || "").replace(/\\/g, "/");
    findings.push({
      file1,
      line1: clone.firstFile.startLoc?.line,
      file2,
      line2: clone.secondFile.startLoc?.line,
      lines: clone.lines,
      tokens: clone.tokens,
      fingerprint: fp,
      isNew,
    });
  }

  return findings;
}

export function formatDuplicationFinding(finding: DuplicationFinding): string {
  const loc1 =
    finding.line1 != null ? `${finding.file1}:${finding.line1}` : finding.file1;
  const loc2 =
    finding.line2 != null ? `${finding.file2}:${finding.line2}` : finding.file2;
  return `${loc1} <=> ${loc2} [${finding.lines} lines, ${finding.tokens} tokens]`;
}

export function formatGitHubDuplicationAnnotation(
  finding: DuplicationFinding,
  level: "error" | "warning" = "error",
): string | null {
  if (!finding.file1 || finding.line1 == null || finding.line1 <= 0) {
    return null;
  }
  const loc2 =
    finding.line2 != null ? `${finding.file2}:${finding.line2}` : finding.file2;
  return `::${level} file=${finding.file1},line=${finding.line1},title=Duplication [jscpd]::New code duplication detected: ${finding.lines} lines (${finding.tokens} tokens) duplicated with ${loc2}`;
}

export function evaluateDuplicationDelta(options: {
  headReport: JscpdReport;
  baseReport?: JscpdReport | null;
  touchedFiles?: string[];
  maxAbsoluteThreshold?: number;
}): DuplicationGateResult {
  const {
    headReport,
    baseReport,
    touchedFiles,
    maxAbsoluteThreshold = 1.5,
  } = options;
  const currentPercentage = headReport.statistics?.total?.percentage ?? 0;
  const basePercentage = baseReport?.statistics?.total?.percentage;

  const findings = extractDuplicationFindings(headReport, baseReport);
  const newClones = findings.filter((f) => f.isNew);
  const violations: string[] = [];

  if (baseReport) {
    for (const clone of newClones) {
      if (touchedFiles && touchedFiles.length > 0) {
        const touches = touchedFiles.some(
          (t) =>
            clone.file1.endsWith(t) ||
            clone.file2.endsWith(t) ||
            t.endsWith(clone.file1) ||
            t.endsWith(clone.file2),
        );
        if (!touches) continue;
      }
      violations.push(
        `New duplication clone block detected: ${formatDuplicationFinding(clone)}`,
      );
    }

    if (basePercentage != null && currentPercentage > basePercentage + 0.0001) {
      violations.push(
        `Duplication rate increased against PR base: ${basePercentage.toFixed(2)}% -> ${currentPercentage.toFixed(2)}%`,
      );
    }
  } else {
    if (currentPercentage > maxAbsoluteThreshold) {
      violations.push(
        `Duplication rate (${currentPercentage.toFixed(2)}%) exceeded absolute threshold (${maxAbsoluteThreshold}%)`,
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    findings,
    newClones,
    currentPercentage,
    basePercentage,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Complexity Hotspots Non-Regression Check
// ─────────────────────────────────────────────────────────────────────────────

export interface HotspotEntry {
  filePath: string;
  functionName: string;
  maxComplexity: number;
}

export interface ComplexityGateResult {
  passed: boolean;
  violations: string[];
}

export function evaluateComplexityHotspots(
  hotspots: HotspotEntry[],
  measureFn?: (
    filePath: string,
  ) => { functionName: string; complexity: number }[],
): ComplexityGateResult {
  const violations: string[] = [];

  if (!measureFn) {
    return { passed: true, violations: [] };
  }

  for (const hotspot of hotspots) {
    const measurements = measureFn(hotspot.filePath);
    const measured = measurements.find(
      (m) =>
        m.functionName === hotspot.functionName || hotspot.functionName === "*",
    );
    if (measured && measured.complexity > hotspot.maxComplexity) {
      violations.push(
        `${hotspot.filePath}:${hotspot.functionName} exceeded baseline complexity of ${hotspot.maxComplexity} (measured ${measured.complexity})`,
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

export function parseComplexityInventory(markdown: string): HotspotEntry[] {
  const lines = markdown.split("\n");
  const entries: HotspotEntry[] = [];
  let currentApp = "";

  for (const line of lines) {
    if (line.includes("apps/backend")) {
      currentApp = "apps/backend";
    } else if (line.includes("apps/web")) {
      currentApp = "apps/web";
    }

    if (line.startsWith("| `src/")) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 4) {
        const rawFile = parts[1].replace(/`/g, "").trim();
        const rawFunc = parts[2]
          .replace(/`/g, "")
          .replace(/\(.*?\)/g, "")
          .trim();
        const complexity = parseInt(parts[3], 10);
        if (rawFile && !isNaN(complexity)) {
          const fullPath = currentApp ? `${currentApp}/${rawFile}` : rawFile;
          entries.push({
            filePath: fullPath,
            functionName: rawFunc,
            maxComplexity: complexity,
          });
        }
      }
    }
  }

  return entries;
}

export function checkComplexityHotspots(options?: {
  touchedFiles?: string[];
  repoRoot?: string;
}): { passed: boolean; violations: string[] } {
  const repoRoot = options?.repoRoot || process.cwd();
  const inventoryPath = path.resolve(repoRoot, "docs/complexity-inventory.md");
  if (!fs.existsSync(inventoryPath)) {
    return { passed: true, violations: [] };
  }

  const content = fs.readFileSync(inventoryPath, "utf-8");
  const hotspots = parseComplexityInventory(content);
  const violations: string[] = [];

  const touched = options?.touchedFiles;
  const targets =
    touched && touched.length > 0
      ? hotspots.filter((h) =>
          touched.some((t) => t.endsWith(h.filePath) || h.filePath.endsWith(t)),
        )
      : hotspots;

  for (const target of targets) {
    const fullPath = path.resolve(repoRoot, target.filePath);
    if (!fs.existsSync(fullPath)) continue;

    const isBackend = target.filePath.startsWith("apps/backend/");
    const appDir = isBackend
      ? path.resolve(repoRoot, "apps/backend")
      : path.resolve(repoRoot, "apps/web");
    const relFile = target.filePath.replace(/^apps\/(backend|web)\//, "");

    const res = spawnSync(
      "bunx",
      [
        "eslint",
        relFile,
        "--rule",
        `complexity: ["error", { "max": ${target.maxComplexity} }]`,
      ],
      { cwd: appDir, encoding: "utf-8" },
    );

    if (res.status !== 0) {
      const output = (res.stdout || res.stderr || "").trim();
      const match = output.match(
        /Function '([^']+)' has a complexity of (\d+)\. Maximum allowed is (\d+)/,
      );
      if (match) {
        violations.push(
          `${target.filePath} Function '${match[1]}' exceeded baseline complexity of ${match[3]} (measured ${match[2]})`,
        );
      } else {
        violations.push(
          `${target.filePath} exceeded baseline complexity of ${target.maxComplexity}`,
        );
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
