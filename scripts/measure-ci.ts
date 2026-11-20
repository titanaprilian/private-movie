#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeAggregateMetrics,
  formatDuration,
  generateMarkdownReport,
  parseDurationMs,
  parseRemoteCachingStatus,
  parseToolingCacheStatus,
  parseTurboSummary,
  parseTurboTaskTimings,
  type CiCacheStatus,
  type CiJobSummary,
  type CiRunSummary,
  type CiStepSummary,
  type CiTurboTask,
} from "./internal/ci-metrics";

interface RawGhRun {
  databaseId: number;
  displayTitle: string;
  status: string;
  conclusion: string;
  event: string;
  headBranch: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

interface RawGhJobStep {
  name: string;
  status: string;
  conclusion: string;
  started_at?: string;
  completed_at?: string;
}

interface RawGhJob {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  started_at: string;
  completed_at: string;
  steps?: RawGhJobStep[];
}

function runGhCommand(cmd: string): string {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    const error = err as { stderr?: string; message: string };
    const errMsg = error.stderr?.trim() || error.message;
    throw new Error(`Failed to execute '${cmd}': ${errMsg}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 20;
  let outputPath = resolve(process.cwd(), "docs/ci-performance-baseline.md");
  let outputJson = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]!, 10);
      i++;
    } else if (arg === "--output" && args[i + 1]) {
      outputPath = resolve(process.cwd(), args[i + 1]!);
      i++;
    } else if (arg === "--json") {
      outputJson = true;
    }
  }

  console.log(`📡 Fetching last ${limit} CI workflow runs from GitHub...`);
  const runsJson = runGhCommand(
    `gh run list --workflow=ci.yml -L ${limit} --json databaseId,displayTitle,status,conclusion,createdAt,updatedAt,event,headBranch,url`,
  );
  const rawRuns: RawGhRun[] = JSON.parse(runsJson);

  console.log(`🔍 Processing details for ${rawRuns.length} runs...`);
  const runSummaries: CiRunSummary[] = [];

  for (const rawRun of rawRuns) {
    let jobs: CiJobSummary[] = [];
    try {
      const jobsJson = runGhCommand(
        `gh api /repos/titanaprilian/private-movie/actions/runs/${rawRun.databaseId}/jobs`,
      );
      const parsedJobs = JSON.parse(jobsJson) as { jobs: RawGhJob[] };

      jobs = (parsedJobs.jobs ?? []).map((j) => {
        const steps: CiStepSummary[] = (j.steps ?? []).map((s) => {
          const stepDur =
            s.started_at && s.completed_at
              ? parseDurationMs(s.started_at, s.completed_at)
              : 0;
          return {
            name: s.name,
            status: s.status,
            conclusion: s.conclusion,
            durationMs: stepDur,
          };
        });

        return {
          id: j.id,
          name: j.name,
          status: j.status,
          conclusion: j.conclusion,
          startedAt: j.started_at,
          completedAt: j.completed_at,
          durationMs: parseDurationMs(j.started_at, j.completed_at),
          steps,
        };
      });
    } catch (err: unknown) {
      console.warn(
        `⚠️ Could not fetch jobs for run ${rawRun.databaseId}: ${(err as Error).message}`,
      );
    }

    // Inspect logs for ci job if present
    const ciJob = jobs.find((j) => j.name === "ci");
    let cacheStatus: CiCacheStatus = {
      remoteCachingEnabled: false,
      turboCachedTasks: 0,
      turboTotalTasks: 0,
      bunCached: false,
      gradleCached: false,
      classification: "cold",
    };
    let turboTasks: CiTurboTask[] = [];

    if (ciJob) {
      try {
        const logContent = runGhCommand(
          `gh api --allow-escape-sequences /repos/titanaprilian/private-movie/actions/jobs/${ciJob.id}/logs`,
        );

        const remoteCaching = parseRemoteCachingStatus(logContent);
        const turboSummary = parseTurboSummary(logContent);
        const tooling = parseToolingCacheStatus(logContent);
        turboTasks = parseTurboTaskTimings(logContent);
        ciJob.turboTasks = turboTasks;

        const totalTasks = turboSummary?.totalTasks ?? 0;
        const cachedTasks = turboSummary?.cachedTasks ?? 0;

        let classification: "cold" | "warm" | "remote-disabled" = "cold";
        if (!remoteCaching) {
          classification = "remote-disabled";
        } else if (cachedTasks > 0) {
          classification = "warm";
        }

        cacheStatus = {
          remoteCachingEnabled: remoteCaching,
          turboCachedTasks: cachedTasks,
          turboTotalTasks: totalTasks,
          bunCached: tooling.bunCached,
          gradleCached: tooling.gradleCached,
          classification,
        };
      } catch {
        // Logs might be expired or unavailable
      }
    }

    const totalDur = parseDurationMs(rawRun.createdAt, rawRun.updatedAt);
    runSummaries.push({
      id: rawRun.databaseId,
      displayTitle: rawRun.displayTitle,
      status: rawRun.status,
      conclusion: rawRun.conclusion,
      event: rawRun.event,
      headBranch: rawRun.headBranch,
      createdAt: rawRun.createdAt,
      updatedAt: rawRun.updatedAt,
      url: rawRun.url,
      totalDurationMs: totalDur,
      cache: cacheStatus,
      jobs,
    });
  }

  const metrics = computeAggregateMetrics(runSummaries);

  if (outputJson) {
    console.log(JSON.stringify({ metrics, runs: runSummaries }, null, 2));
    return;
  }

  const reportMarkdown = generateMarkdownReport(runSummaries, metrics);
  writeFileSync(outputPath, reportMarkdown, "utf-8");

  console.log(
    `\n✅ CI Baseline Report generated successfully at: ${outputPath}`,
  );
  console.log(`📊 Sampled Runs: ${metrics.totalRuns}`);
  console.log(
    `⏱️  PR Median Duration: ${formatDuration(metrics.medianPrDurationMs)}`,
  );
  console.log(
    `⏱️  CI Job Median Duration: ${formatDuration(metrics.medianCiJobDurationMs)}`,
  );
  console.log(
    `⏱️  Android Job Median Duration: ${formatDuration(metrics.medianAndroidJobDurationMs)}`,
  );
  console.log(
    `⏱️  E2E Job Median Duration: ${formatDuration(metrics.medianE2eJobDurationMs)}`,
  );
}

main().catch((err) => {
  console.error("❌ Fatal error measuring CI runs:", err);
  process.exit(1);
});
