import { describe, expect, it } from "vitest";
import {
  computeAggregateMetrics,
  formatDuration,
  generateMarkdownReport,
  parseDurationMs,
  parseRemoteCachingStatus,
  parseToolingCacheStatus,
  parseTurboSummary,
  parseTurboTaskTimings,
  type CiRunSummary,
} from "../../../scripts/internal/ci-metrics";

describe("ci-metrics", () => {
  describe("parseDurationMs & formatDuration", () => {
    it("computes duration in milliseconds correctly", () => {
      const start = "2026-11-20T12:41:45Z";
      const end = "2026-11-20T12:48:56Z";
      expect(parseDurationMs(start, end)).toBe(431000);
    });

    it("formats milliseconds into readable mm:ss or seconds", () => {
      expect(formatDuration(431000)).toBe("7m 11s");
      expect(formatDuration(45000)).toBe("45s");
      expect(formatDuration(1500)).toBe("1s");
      expect(formatDuration(0)).toBe("0s");
    });
  });

  describe("parseRemoteCachingStatus", () => {
    it("detects remote caching disabled from log output", () => {
      const log = `
2026-11-20T12:42:20.9785721Z    • Packages in scope: @repo/backend, @repo/web
2026-11-20T12:42:20.9789090Z    • Remote caching disabled
`;
      expect(parseRemoteCachingStatus(log)).toBe(false);
    });

    it("detects remote caching enabled when not disabled", () => {
      const log = `
2026-11-20T12:42:20.9785721Z    • Packages in scope: @repo/backend, @repo/web
2026-11-20T12:42:20.9789090Z    • Remote caching enabled (team: my-team)
`;
      expect(parseRemoteCachingStatus(log)).toBe(true);
    });
  });

  describe("parseTurboSummary", () => {
    it("extracts task count and cached count from Turbo summary", () => {
      const log = `
2026-11-20T12:48:31.8753053Z  Tasks:    23 successful, 23 total
2026-11-20T12:48:31.8753313Z Cached:    0 cached, 23 total
2026-11-20T12:48:31.8753549Z   Time:    6m10.915s 
`;
      const summary = parseTurboSummary(log);
      expect(summary).not.toBeNull();
      expect(summary?.totalTasks).toBe(23);
      expect(summary?.cachedTasks).toBe(0);
      expect(summary?.totalTimeSeconds).toBeCloseTo(370.915, 1);
    });

    it("handles partial cache hits", () => {
      const log = `
Tasks:    18 successful, 18 total
Cached:   7 cached, 18 total
Time:    1m20.500s
`;
      const summary = parseTurboSummary(log);
      expect(summary).not.toBeNull();
      expect(summary?.totalTasks).toBe(18);
      expect(summary?.cachedTasks).toBe(7);
      expect(summary?.totalTimeSeconds).toBeCloseTo(80.5, 1);
    });
  });

  describe("parseToolingCacheStatus", () => {
    it("detects Bun cached version in logs", () => {
      const log = `
2026-11-20T12:42:12.2912672Z Using a cached version of Bun: 1.3.14+0d9b296af
`;
      const status = parseToolingCacheStatus(log);
      expect(status.bunCached).toBe(true);
      expect(status.gradleCached).toBe(false);
    });

    it("detects Gradle cache re-use in logs", () => {
      const log = `
2026-11-20T12:41:55.0000000Z Reusing configuration cache.
`;
      const status = parseToolingCacheStatus(log);
      expect(status.gradleCached).toBe(true);
    });
  });

  describe("parseTurboTaskTimings", () => {
    it("parses task group headers and computes sequential task durations", () => {
      const log = `
2026-11-20T12:42:26.0000000Z ##[group]@repo/contracts:typecheck
2026-11-20T12:42:30.0000000Z ##[group]@repo/media-scraper:build
2026-11-20T12:42:45.0000000Z ##[group]@repo/backend:test:coverage
2026-11-20T12:44:00.0000000Z ##[group]@repo/web:test:coverage
2026-11-20T12:45:30.0000000Z ##[endgroup]
`;
      const tasks = parseTurboTaskTimings(log);
      expect(tasks.length).toBe(4);
      expect(tasks[0]?.name).toBe("@repo/contracts:typecheck");
      expect(tasks[0]?.durationMs).toBe(4000); // 42:26 to 42:30
      expect(tasks[1]?.name).toBe("@repo/media-scraper:build");
      expect(tasks[1]?.durationMs).toBe(15000); // 42:30 to 42:45
      expect(tasks[2]?.name).toBe("@repo/backend:test:coverage");
      expect(tasks[2]?.durationMs).toBe(75000); // 42:45 to 44:00
      expect(tasks[3]?.name).toBe("@repo/web:test:coverage");
      expect(tasks[3]?.durationMs).toBe(90000); // 44:00 to 45:30
    });
  });

  describe("computeAggregateMetrics & generateMarkdownReport", () => {
    const mockRuns: CiRunSummary[] = [
      {
        id: 44737921659,
        displayTitle: "feat(backend): wire flag (#1002)",
        status: "completed",
        conclusion: "success",
        event: "pull_request",
        headBranch: "fix/issue-1002",
        createdAt: "2026-11-20T12:41:43Z",
        updatedAt: "2026-11-20T12:48:57Z",
        url: "https://github.com/titanaprilian/private-movie/actions/runs/44737921659",
        totalDurationMs: 434000,
        cache: {
          remoteCachingEnabled: false,
          turboCachedTasks: 0,
          turboTotalTasks: 23,
          bunCached: true,
          gradleCached: false,
          classification: "remote-disabled",
        },
        jobs: [
          {
            id: 136293906725,
            name: "ci",
            status: "completed",
            conclusion: "success",
            startedAt: "2026-11-20T12:41:45Z",
            completedAt: "2026-11-20T12:48:56Z",
            durationMs: 431000,
            steps: [
              {
                name: "Run CI pipeline",
                status: "completed",
                conclusion: "success",
                durationMs: 372000,
              },
            ],
            turboTasks: [
              {
                name: "@repo/backend:test:coverage",
                timestamp: "2026-11-20T12:45:14Z",
                durationMs: 101000,
              },
              {
                name: "@repo/web:test:coverage",
                timestamp: "2026-11-20T12:46:55Z",
                durationMs: 96000,
              },
            ],
          },
          {
            id: 136293906455,
            name: "android",
            status: "completed",
            conclusion: "success",
            startedAt: "2026-11-20T12:41:45Z",
            completedAt: "2026-11-20T12:42:39Z",
            durationMs: 54000,
            steps: [],
          },
          {
            id: 136293906189,
            name: "e2e",
            status: "completed",
            conclusion: "success",
            startedAt: "2026-11-20T12:41:45Z",
            completedAt: "2026-11-20T12:43:03Z",
            durationMs: 78000,
            steps: [],
          },
        ],
      },
    ];

    it("computes medians and separates PR vs push metrics", () => {
      const aggregate = computeAggregateMetrics(mockRuns);
      expect(aggregate.totalRuns).toBe(1);
      expect(aggregate.prRunsCount).toBe(1);
      expect(aggregate.pushRunsCount).toBe(0);
      expect(aggregate.medianPrDurationMs).toBe(434000);
      expect(aggregate.medianCiJobDurationMs).toBe(431000);
      expect(aggregate.medianAndroidJobDurationMs).toBe(54000);
      expect(aggregate.medianE2eJobDurationMs).toBe(78000);
    });

    it("generates markdown report with tables, cache notes, and decision matrix", () => {
      const aggregate = computeAggregateMetrics(mockRuns);
      const markdown = generateMarkdownReport(mockRuns, aggregate);

      expect(markdown).toContain(
        "# CI Job Duration & Fast-Lane Baseline Report",
      );
      expect(markdown).toContain("44737921659");
      expect(markdown).toContain("Remote caching disabled");
      expect(markdown).toContain("Decision Matrix");
      expect(markdown).toContain("Split Fast / Slow Lanes");
    });
  });
});
