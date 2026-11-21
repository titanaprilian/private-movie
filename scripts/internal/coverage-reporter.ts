import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type CoverageMetric = "lines" | "branches" | "functions" | "statements";

export const COVERAGE_METRICS: readonly CoverageMetric[] = [
  "lines",
  "branches",
  "functions",
  "statements",
] as const;

export interface MetricSummary {
  pct: number;
  total?: number;
  covered?: number;
  skipped?: number;
}

export interface PackageCoverageSummary {
  total: Record<CoverageMetric, MetricSummary>;
}

export interface MetricDelta {
  current: number;
  base: number | null;
  delta: number | null;
}

export interface PackageDeltaReport {
  packageName: string;
  metrics: Record<CoverageMetric, MetricDelta>;
  isAdded: boolean;
}

export interface CoverageReportOptions {
  currentSummaries: Map<string, PackageCoverageSummary>;
  baseSummaries?: Map<string, PackageCoverageSummary> | null;
  baseAvailable?: boolean;
}

export interface CoverageReportResult {
  packages: PackageDeltaReport[];
  baseAvailable: boolean;
  markdown: string;
}

export interface CoverageCliOptions {
  baseDir?: string;
  currentDir?: string;
}

export function computeMetricDelta(
  currentPct: number,
  basePct?: number | null,
): MetricDelta {
  if (basePct === undefined || basePct === null) {
    return {
      current: currentPct,
      base: null,
      delta: null,
    };
  }

  const rawDelta = currentPct - basePct;
  const delta = Math.round(rawDelta * 100) / 100;

  return {
    current: currentPct,
    base: basePct,
    delta: Object.is(delta, -0) ? 0 : delta,
  };
}

export function formatMetricCell(
  metric: MetricDelta,
  baseAvailable: boolean,
): string {
  const currentStr = `${metric.current}%`;
  if (!baseAvailable) {
    return currentStr;
  }

  if (metric.base === null) {
    return `${currentStr} (base: n/a)`;
  }

  const delta = metric.delta ?? 0;
  const deltaStr = delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : `0%`;
  return `${currentStr} (base: ${metric.base}%, ${deltaStr})`;
}

export function computePackageDeltas(
  currentSummaries: Map<string, PackageCoverageSummary>,
  baseSummaries?: Map<string, PackageCoverageSummary> | null,
  baseAvailable = true,
): PackageDeltaReport[] {
  const reports: PackageDeltaReport[] = [];

  const sortedPackageNames = Array.from(currentSummaries.keys()).sort();

  for (const packageName of sortedPackageNames) {
    const currentSummary = currentSummaries.get(packageName);
    if (!currentSummary?.total) continue;

    let baseSummary = baseAvailable ? baseSummaries?.get(packageName) : null;
    if (!baseSummary && baseAvailable && baseSummaries) {
      const baseName = path.basename(packageName);
      baseSummary =
        baseSummaries.get(baseName) ||
        baseSummaries.get(`apps/${baseName}`) ||
        baseSummaries.get(`packages/${baseName}`);
    }

    const isAdded = baseAvailable && !baseSummary;
    const metrics = {} as Record<CoverageMetric, MetricDelta>;

    for (const metric of COVERAGE_METRICS) {
      const curPct = currentSummary.total[metric]?.pct ?? 0;
      const basePct = baseAvailable
        ? (baseSummary?.total[metric]?.pct ?? null)
        : null;
      metrics[metric] = computeMetricDelta(curPct, basePct);
    }

    reports.push({
      packageName,
      metrics,
      isAdded,
    });
  }

  return reports;
}

export function formatCoverageMarkdown(options: {
  packages: PackageDeltaReport[];
  baseAvailable: boolean;
}): string {
  const { packages, baseAvailable } = options;
  const lines: string[] = ["### Coverage", ""];

  if (!baseAvailable) {
    lines.push(
      "> Base coverage report unavailable for base branch. Showing current coverage only.",
      "",
    );
  }

  lines.push("| Package | Lines | Branches | Functions | Statements |");
  lines.push("| --- | --- | --- | --- | --- |");

  if (packages.length === 0) {
    lines.push("| _no reports produced_ | | | | |");
  } else {
    for (const pkg of packages) {
      const lineStr = formatMetricCell(pkg.metrics.lines, baseAvailable);
      const branchStr = formatMetricCell(pkg.metrics.branches, baseAvailable);
      const funcStr = formatMetricCell(pkg.metrics.functions, baseAvailable);
      const stmtStr = formatMetricCell(pkg.metrics.statements, baseAvailable);
      lines.push(
        `| \`${pkg.packageName}\` | ${lineStr} | ${branchStr} | ${funcStr} | ${stmtStr} |`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function generateCoverageReport(
  options: CoverageReportOptions,
): CoverageReportResult {
  const baseAvailable = Boolean(options.baseAvailable);
  const packages = computePackageDeltas(
    options.currentSummaries,
    options.baseSummaries,
    baseAvailable,
  );
  const markdown = formatCoverageMarkdown({
    packages,
    baseAvailable,
  });

  return {
    packages,
    baseAvailable,
    markdown,
  };
}

export function parseCliArgs(
  args: string[],
  env: Record<string, string | undefined> = process.env,
): CoverageCliOptions {
  let baseDir: string | undefined = env.BASE_COVERAGE_DIR || undefined;
  let currentDir: string | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--base-dir" && args[i + 1]) {
      baseDir = args[i + 1];
      i++;
    } else if (arg.startsWith("--base-dir=")) {
      baseDir = arg.slice("--base-dir=".length);
    } else if (arg === "--current-dir" && args[i + 1]) {
      currentDir = args[i + 1];
      i++;
    } else if (arg.startsWith("--current-dir=")) {
      currentDir = arg.slice("--current-dir=".length);
    }
  }

  return { baseDir, currentDir };
}

export function parseCoverageSummaryJson(
  rawJson: string,
): PackageCoverageSummary | null {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== "object" || !parsed.total) {
      return null;
    }
    for (const metric of COVERAGE_METRICS) {
      if (
        !parsed.total[metric] ||
        typeof parsed.total[metric].pct !== "number"
      ) {
        return null;
      }
    }
    return parsed as PackageCoverageSummary;
  } catch {
    return null;
  }
}

export function scanCoverageDirectory(
  rootDir: string,
  roots = ["apps", "packages"],
): Map<string, PackageCoverageSummary> {
  const summaries = new Map<string, PackageCoverageSummary>();
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    return summaries;
  }

  for (const root of roots) {
    const rootPath = path.join(rootDir, root);
    if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
      continue;
    }

    let entries: string[] = [];
    try {
      entries = readdirSync(rootPath);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const packageDir = path.join(rootPath, entry);
      if (!existsSync(packageDir) || !statSync(packageDir).isDirectory()) {
        continue;
      }

      const candidateFiles = [
        path.join(packageDir, "coverage", "coverage-summary.json"),
        path.join(packageDir, "coverage-summary.json"),
      ];

      for (const candidate of candidateFiles) {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          try {
            const raw = readFileSync(candidate, "utf8");
            const parsed = parseCoverageSummaryJson(raw);
            if (parsed) {
              summaries.set(`${root}/${entry}`, parsed);
              break;
            }
          } catch {
            // Ignore unreadable or corrupt coverage file
          }
        }
      }
    }
  }

  if (summaries.size === 0) {
    try {
      const topLevelEntries = readdirSync(rootDir);
      for (const entry of topLevelEntries) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const entryPath = path.join(rootDir, entry);
        if (!existsSync(entryPath) || !statSync(entryPath).isDirectory()) {
          continue;
        }

        const candidateFiles = [
          path.join(entryPath, "coverage", "coverage-summary.json"),
          path.join(entryPath, "coverage-summary.json"),
        ];

        for (const candidate of candidateFiles) {
          if (existsSync(candidate) && statSync(candidate).isFile()) {
            try {
              const raw = readFileSync(candidate, "utf8");
              const parsed = parseCoverageSummaryJson(raw);
              if (parsed) {
                summaries.set(entry, parsed);
                break;
              }
            } catch {
              // Ignore corrupt file
            }
          }
        }
      }
    } catch {
      // Ignore directory read failure
    }
  }

  return summaries;
}
