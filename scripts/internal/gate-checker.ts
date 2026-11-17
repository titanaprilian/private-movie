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

export interface GateEvaluationResult {
  passed: boolean;
  violations: string[];
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

export function evaluateKnipFindings(report: KnipReport): GateEvaluationResult {
  const fingerprints = extractKnipFingerprints(report);
  const violations = Array.from(fingerprints);

  return {
    passed: violations.length === 0,
    violations,
  };
}
