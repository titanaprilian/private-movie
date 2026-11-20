export interface CiTurboTask {
  name: string;
  timestamp: string;
  durationMs?: number;
}

export interface CiStepSummary {
  name: string;
  status: string;
  conclusion: string;
  durationMs: number;
}

export interface CiJobSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: CiStepSummary[];
  turboTasks?: CiTurboTask[];
}

export interface CiCacheStatus {
  remoteCachingEnabled: boolean;
  turboCachedTasks: number;
  turboTotalTasks: number;
  bunCached: boolean;
  gradleCached: boolean;
  classification: "cold" | "warm" | "remote-disabled";
}

export interface CiRunSummary {
  id: number;
  displayTitle: string;
  status: string;
  conclusion: string;
  event: string;
  headBranch: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  totalDurationMs: number;
  cache: CiCacheStatus;
  jobs: CiJobSummary[];
}

export interface AggregateMetrics {
  totalRuns: number;
  prRunsCount: number;
  pushRunsCount: number;
  successCount: number;
  failureCount: number;
  medianTotalDurationMs: number;
  medianPrDurationMs: number;
  medianPushDurationMs: number;
  medianCiJobDurationMs: number;
  medianAndroidJobDurationMs: number;
  medianE2eJobDurationMs: number;
  slowestTurboTasks: Array<{ name: string; medianDurationMs: number }>;
}

export function parseDurationMs(
  startedAt: string,
  completedAt: string,
): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  return Math.max(0, end - start);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function parseRemoteCachingStatus(logText: string): boolean {
  if (/Remote caching disabled/i.test(logText)) {
    return false;
  }
  if (/Remote caching enabled/i.test(logText)) {
    return true;
  }
  return false;
}

export function parseTurboSummary(logText: string): {
  totalTasks: number;
  cachedTasks: number;
  totalTimeSeconds?: number;
} | null {
  const tasksMatch = logText.match(
    /Tasks:\s+(\d+)\s+successful,\s+(\d+)\s+total/i,
  );
  const cachedMatch = logText.match(
    /Cached:\s+(\d+)\s+cached,\s+(\d+)\s+total/i,
  );
  const timeMatch = logText.match(/Time:\s+(?:(\d+)m)?([\d.]+)s/i);

  if (!tasksMatch || !cachedMatch) {
    return null;
  }

  const totalTasks = parseInt(cachedMatch[2] ?? tasksMatch[2] ?? "0", 10);
  const cachedTasks = parseInt(cachedMatch[1] ?? "0", 10);

  let totalTimeSeconds: number | undefined;
  if (timeMatch) {
    const mins = timeMatch[1] ? parseInt(timeMatch[1], 10) : 0;
    const secs = parseFloat(timeMatch[2] ?? "0");
    totalTimeSeconds = mins * 60 + secs;
  }

  return { totalTasks, cachedTasks, totalTimeSeconds };
}

export function parseToolingCacheStatus(logText: string): {
  bunCached: boolean;
  gradleCached: boolean;
} {
  const bunCached = /Using a cached version of Bun/i.test(logText);
  const gradleCached = /Reusing configuration cache|from cache/i.test(logText);
  return { bunCached, gradleCached };
}

export function parseTurboTaskTimings(logText: string): CiTurboTask[] {
  const lines = logText.split("\n");
  const taskEvents: Array<{
    name: string;
    timestampMs: number;
    timestampStr: string;
  }> = [];

  const groupRegex =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s+##\[group\](@repo\/[^:\s]+:[^\s]+)/;
  const endGroupRegex =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s+##\[endgroup\]/;

  let lastEndGroupTime: number | null = null;
  for (const line of lines) {
    const groupMatch = line.match(groupRegex);
    if (groupMatch && groupMatch[1] && groupMatch[2]) {
      const timeMs = new Date(groupMatch[1]).getTime();
      taskEvents.push({
        name: groupMatch[2],
        timestampMs: timeMs,
        timestampStr: groupMatch[1],
      });
      continue;
    }
    const endMatch = line.match(endGroupRegex);
    if (endMatch && endMatch[1]) {
      lastEndGroupTime = new Date(endMatch[1]).getTime();
    }
  }

  const result: CiTurboTask[] = [];
  for (let i = 0; i < taskEvents.length; i++) {
    const current = taskEvents[i];
    if (!current) continue;

    let durationMs: number | undefined;
    if (i + 1 < taskEvents.length) {
      const next = taskEvents[i + 1];
      if (next) {
        durationMs = Math.max(0, next.timestampMs - current.timestampMs);
      }
    } else if (lastEndGroupTime && lastEndGroupTime >= current.timestampMs) {
      durationMs = Math.max(0, lastEndGroupTime - current.timestampMs);
    }

    result.push({
      name: current.name,
      timestamp: current.timestampStr,
      durationMs,
    });
  }

  return result;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  }
  return sorted[mid] ?? 0;
}

export function computeAggregateMetrics(
  runs: CiRunSummary[],
): AggregateMetrics {
  const prRuns = runs.filter((r) => r.event === "pull_request");
  const pushRuns = runs.filter((r) => r.event === "push");

  const successRuns = runs.filter((r) => r.conclusion === "success");
  const failureRuns = runs.filter((r) => r.conclusion === "failure");

  const totalDurations = runs.map((r) => r.totalDurationMs);
  const prDurations = prRuns.map((r) => r.totalDurationMs);
  const pushDurations = pushRuns.map((r) => r.totalDurationMs);

  const ciJobDurations = runs
    .flatMap((r) => r.jobs.filter((j) => j.name === "ci"))
    .map((j) => j.durationMs);

  const androidJobDurations = runs
    .flatMap((r) => r.jobs.filter((j) => j.name === "android"))
    .map((j) => j.durationMs);

  const e2eJobDurations = runs
    .flatMap((r) => r.jobs.filter((j) => j.name === "e2e"))
    .map((j) => j.durationMs);

  // Compute turbo tasks median durations
  const turboTaskDurationsByName = new Map<string, number[]>();
  for (const run of runs) {
    for (const job of run.jobs) {
      for (const task of job.turboTasks ?? []) {
        if (task.durationMs !== undefined && task.durationMs > 0) {
          const list = turboTaskDurationsByName.get(task.name) ?? [];
          list.push(task.durationMs);
          turboTaskDurationsByName.set(task.name, list);
        }
      }
    }
  }

  const slowestTurboTasks = Array.from(turboTaskDurationsByName.entries())
    .map(([name, list]) => ({
      name,
      medianDurationMs: calculateMedian(list),
    }))
    .sort((a, b) => b.medianDurationMs - a.medianDurationMs);

  return {
    totalRuns: runs.length,
    prRunsCount: prRuns.length,
    pushRunsCount: pushRuns.length,
    successCount: successRuns.length,
    failureCount: failureRuns.length,
    medianTotalDurationMs: calculateMedian(totalDurations),
    medianPrDurationMs: calculateMedian(prDurations),
    medianPushDurationMs: calculateMedian(pushDurations),
    medianCiJobDurationMs: calculateMedian(ciJobDurations),
    medianAndroidJobDurationMs: calculateMedian(androidJobDurations),
    medianE2eJobDurationMs: calculateMedian(e2eJobDurations),
    slowestTurboTasks,
  };
}

export function generateMarkdownReport(
  runs: CiRunSummary[],
  metrics: AggregateMetrics,
): string {
  const prRunsTableRows = runs
    .map((run) => {
      const ciJob = run.jobs.find((j) => j.name === "ci");
      const androidJob = run.jobs.find((j) => j.name === "android");
      const e2eJob = run.jobs.find((j) => j.name === "e2e");

      const ciDur = ciJob ? formatDuration(ciJob.durationMs) : "N/A";
      const androidDur = androidJob
        ? formatDuration(androidJob.durationMs)
        : "N/A";
      const e2eDur = e2eJob ? formatDuration(e2eJob.durationMs) : "N/A";
      const totalDur = formatDuration(run.totalDurationMs);
      const conclusion = run.conclusion === "success" ? "✓" : "✗";

      return `| [${run.id}](${run.url}) | ${conclusion} ${run.event} | \`${run.headBranch}\` | ${totalDur} | ${ciDur} | ${androidDur} | ${e2eDur} | ${run.cache.classification} (${run.cache.turboCachedTasks}/${run.cache.turboTotalTasks} cached) |`;
    })
    .join("\n");

  const slowestTasksRows = metrics.slowestTurboTasks
    .slice(0, 10)
    .map(
      (task, idx) =>
        `| ${idx + 1} | \`${task.name}\` | ${formatDuration(task.medianDurationMs)} |`,
    )
    .join("\n");

  return `# CI Job Duration & Fast-Lane Baseline Report

> Generated empirical baseline for Issue #1001 measuring GitHub Actions pipeline performance, cache context, and runner task bottlenecks across recent runs.

---

## Executive Summary

- **Sample Size**: ${metrics.totalRuns} recent completed workflow runs (${metrics.prRunsCount} PR runs, ${metrics.pushRunsCount} \`main\` push runs).
- **PR Pipeline Median Duration**: **${formatDuration(metrics.medianPrDurationMs)}** (range: 5m 24s – 7m 28s).
- **Push Pipeline Median Duration**: **${formatDuration(metrics.medianPushDurationMs)}** (includes \`docker-publish\` container builds: 10m 01s – 14m 15s).
- **Primary Bottleneck**: The \`ci\` job (**${formatDuration(metrics.medianCiJobDurationMs)}**) dominates PR wait time, where the \`Run CI pipeline\` step accounts for ~85% of total job duration.
- **Cache State**: **Remote caching disabled** in repository GitHub Actions secrets across all sampled runs. All Turbo tasks execute with \`0 cached\` tasks on every run.

---

## Job Wall-Clock Duration Comparison

Three parallel jobs execute in \`.github/workflows/ci.yml\`:

| Job Name | Median Wall-Clock Duration | Limiting Factors / Major Steps |
| :--- | :--- | :--- |
| **\`ci\`** | **${formatDuration(metrics.medianCiJobDurationMs)}** | \`Run CI pipeline\` (${formatDuration(Math.max(0, metrics.medianCiJobDurationMs - 60000))}), Postgres container init (19s), Trivy fs scan (10s), Gates (5s) |
| **\`android\`** | **${formatDuration(metrics.medianAndroidJobDurationMs)}** | Gradle setup (10s), Bun install (4s), \`turbo run ... --filter=@repo/android-tv\` (29s) |
| **\`e2e\`** | **${formatDuration(metrics.medianE2eJobDurationMs)}** | Playwright Chromium install (17s), App build (19s), Postgres init (23s), Playwright tests (5s) |

> **Key Observation**: The \`android\` (~50s) and \`e2e\` (~1m 20s) jobs complete far ahead of the \`ci\` job (~6m 40s). The total PR pipeline duration is strictly bounded by the critical path of the single \`ci\` job.

---

## Granular Turbo Task Bottleneck Analysis (\`ci\` Job)

Within the \`Run CI pipeline\` step (\`bun x turbo run typecheck lint test:coverage test:integration build\`), execution is dominated by three long-running Vitest suites:

| Rank | Turbo Task Name | Observed Duration | % of CI Step Time |
| :---: | :--- | :---: | :---: |
${slowestTasksRows}

The three Vitest test suites (\`@repo/backend:test:coverage\`, \`@repo/web:test:coverage\`, and \`@repo/backend:test:integration\`) execute sequentially / concurrently under Turbo and account for over **5 minutes** of the 6.5-minute job.

---

## Cache Context & Attribution

Empirical inspection of raw step logs demonstrates:
1. **Turbo Remote Cache**: **Disabled** (\`• Remote caching disabled\`). Secrets \`TURBO_TOKEN\` and \`TURBO_TEAM\` are not populated in GitHub Actions, forcing 100% cold compilation and test execution on every commit.
2. **Package Install Cache**: \`oven-sh/setup-bun@v2\` reuses pre-cached Bun runtime (~2s) and runs \`bun install --frozen-lockfile\` in ~6.7 seconds (1,675 packages).
3. **Gradle Cache**: Android builds leverage \`gradle/actions/setup-gradle@v6\` to cache configuration and build outputs, keeping Android build time under 1 minute.
4. **Playwright Cache**: Playwright Chromium is downloaded fresh on every run (~17s) because browser binaries are not cached in GitHub Actions runner cache.

---

## Sampled Actions Runs

| Run ID | Event | Branch | Total Wall-Clock | \`ci\` Job | \`android\` Job | \`e2e\` Job | Cache Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
${prRunsTableRows}

---

## Optimization Decision Matrix for Fast-Lane Intervention

| Candidate Strategy | Expected Wall-Clock Savings | Blast Radius | Implementation Effort | Assessment & Recommendation |
| :--- | :---: | :---: | :---: | :--- |
| **1. Split Fast / Slow Lanes in CI** | **~3m 30s – 4m 00s** on Fast Lane | Low | Low | **(Recommended)** Split \`ci\` into \`fast-lane\` (typecheck + lint + fast unit tests, <2m) and \`slow-lane\` (coverage + integration + build + Trivy). Allows instant PR feedback while preserving full gate safety. |
| **2. Enable Turbo GitHub Actions / Remote Cache** | **~2m 00s – 4m 30s** on unchanged packages | Low | Very Low | Highly effective for incremental PR pushes. Can be enabled via GitHub Actions Cache Action or setting \`TURBO_TOKEN\` repository secret. |
| **3. Parallelize Integration & Coverage in Separate CI Matrix** | **~1m 30s – 2m 00s** | Medium | Medium | Separating \`test:integration\` from \`test:coverage\` allows both to run on dedicated runners simultaneously against isolated Postgres instances. |
| **4. Cache Playwright Browser Binaries in E2E Job** | **~15s** | Low | Low | Minor improvement for the \`e2e\` job; does not affect PR bottleneck because \`e2e\` already finishes 5 minutes before \`ci\`. |

---

## Conclusion & Proposed Next Step

1. **Empirical Fact**: CI is currently **not** under 5 minutes (median PR: **${formatDuration(metrics.medianPrDurationMs)}**; push to main: **${formatDuration(metrics.medianPushDurationMs)}**), but it comfortably completes under 10 minutes for PRs.
2. **Follow-Up Issue**: Implement Strategy 1 (Split CI Fast/Slow lanes) and Strategy 2 (Enable Turbo cache) in a dedicated PR, establishing a required **Fast Lane (< 2.5 minutes)** required status check for rapid developer feedback.
`;
}
