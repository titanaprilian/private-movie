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
