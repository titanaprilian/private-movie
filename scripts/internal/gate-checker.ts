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

export interface GateComparisonResult {
  passed: boolean;
  currentFingerprints: Set<string>;
  baselineFingerprints: Set<string>;
  newViolations: string[];
  resolvedCount: number;
  resolvedFingerprints: string[];
}

export interface BaselinePruneResult {
  success: boolean;
  prunedReport: KnipReport | null;
  prunedCount: number;
  newViolations: string[];
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

export function compareKnipFindings(
  currentReport: KnipReport,
  baselineReport: KnipReport,
): GateComparisonResult {
  const currentFingerprints = extractKnipFingerprints(currentReport);
  const baselineFingerprints = extractKnipFingerprints(baselineReport);

  const newViolations: string[] = [];
  for (const fp of currentFingerprints) {
    if (!baselineFingerprints.has(fp)) {
      newViolations.push(fp);
    }
  }

  const resolvedFingerprints: string[] = [];
  for (const fp of baselineFingerprints) {
    if (!currentFingerprints.has(fp)) {
      resolvedFingerprints.push(fp);
    }
  }

  return {
    passed: newViolations.length === 0,
    currentFingerprints,
    baselineFingerprints,
    newViolations,
    resolvedCount: resolvedFingerprints.length,
    resolvedFingerprints,
  };
}

export function pruneKnipBaseline(
  currentReport: KnipReport,
  baselineReport: KnipReport,
): BaselinePruneResult {
  const comparison = compareKnipFindings(currentReport, baselineReport);

  if (!comparison.passed) {
    return {
      success: false,
      prunedReport: null,
      prunedCount: 0,
      newViolations: comparison.newViolations,
    };
  }

  let prunedCount = 0;
  const prunedIssues: KnipFileIssue[] = [];

  for (const item of baselineReport.issues || []) {
    const file = String(item.file || "");
    const updatedItem: KnipFileIssue = { ...item };
    let hasAnyIssues = false;

    for (const cat of KNIP_CATEGORIES) {
      const arr = item[cat];
      if (Array.isArray(arr)) {
        const keptEntries: unknown[] = [];
        for (const entry of arr) {
          const fp = computeEntryFingerprint(file, cat, entry);
          if (comparison.currentFingerprints.has(fp)) {
            keptEntries.push(entry);
          } else {
            prunedCount++;
          }
        }
        updatedItem[cat] = keptEntries;
        if (keptEntries.length > 0) {
          hasAnyIssues = true;
        }
      }
    }

    if (hasAnyIssues) {
      prunedIssues.push(updatedItem);
    }
  }

  const prunedReport: KnipReport = {
    ...baselineReport,
    issues: prunedIssues,
  };

  return {
    success: true,
    prunedReport,
    prunedCount,
    newViolations: [],
  };
}
