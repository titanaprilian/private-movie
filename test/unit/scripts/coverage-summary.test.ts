import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  computeMetricDelta,
  computePackageDeltas,
  formatCoverageMarkdown,
  formatMetricCell,
  generateCoverageReport,
  parseCliArgs,
  parseCoverageSummaryJson,
  scanCoverageDirectory,
  type PackageCoverageSummary,
} from "../../../scripts/internal/coverage-reporter";

describe("coverage-reporter", () => {
  describe("computeMetricDelta", () => {
    it("computes positive delta correctly", () => {
      const result = computeMetricDelta(85.5, 80);
      expect(result).toEqual({
        current: 85.5,
        base: 80,
        delta: 5.5,
      });
    });

    it("computes negative delta correctly", () => {
      const result = computeMetricDelta(74.25, 80.5);
      expect(result).toEqual({
        current: 74.25,
        base: 80.5,
        delta: -6.25,
      });
    });

    it("handles zero delta and avoids negative zero", () => {
      const result = computeMetricDelta(80, 80);
      expect(result).toEqual({
        current: 80,
        base: 80,
        delta: 0,
      });
      expect(Object.is(result.delta, -0)).toBe(false);
    });

    it("handles missing base (null or undefined)", () => {
      expect(computeMetricDelta(90, null)).toEqual({
        current: 90,
        base: null,
        delta: null,
      });
      expect(computeMetricDelta(90, undefined)).toEqual({
        current: 90,
        base: null,
        delta: null,
      });
    });

    it("handles boundary condition: 0% and 100%", () => {
      expect(computeMetricDelta(0, 0)).toEqual({
        current: 0,
        base: 0,
        delta: 0,
      });
      expect(computeMetricDelta(100, 0)).toEqual({
        current: 100,
        base: 0,
        delta: 100,
      });
      expect(computeMetricDelta(0, 100)).toEqual({
        current: 0,
        base: 100,
        delta: -100,
      });
    });

    it("rounds floating point inaccuracies to 2 decimal places", () => {
      const result = computeMetricDelta(33.33, 33.3);
      expect(result.delta).toBe(0.03);
    });
  });

  describe("formatMetricCell", () => {
    it("formats cell when base is unavailable", () => {
      const metric = { current: 85.5, base: null, delta: null };
      expect(formatMetricCell(metric, false)).toBe("85.5%");
    });

    it("formats cell for added package (base available but package base is null)", () => {
      const metric = { current: 92, base: null, delta: null };
      expect(formatMetricCell(metric, true)).toBe("92% (base: n/a)");
    });

    it("formats cell with positive delta", () => {
      const metric = { current: 85.5, base: 80, delta: 5.5 };
      expect(formatMetricCell(metric, true)).toBe("85.5% (base: 80%, +5.5%)");
    });

    it("formats cell with negative delta", () => {
      const metric = { current: 75, base: 80, delta: -5 };
      expect(formatMetricCell(metric, true)).toBe("75% (base: 80%, -5%)");
    });

    it("formats cell with zero delta", () => {
      const metric = { current: 80, base: 80, delta: 0 };
      expect(formatMetricCell(metric, true)).toBe("80% (base: 80%, 0%)");
    });
  });

  describe("computePackageDeltas", () => {
    const mockSummary = (
      lines: number,
      branches: number,
      functions: number,
      statements: number,
    ): PackageCoverageSummary => ({
      total: {
        lines: { pct: lines },
        branches: { pct: branches },
        functions: { pct: functions },
        statements: { pct: statements },
      },
    });

    it("computes package deltas when base is available", () => {
      const current = new Map<string, PackageCoverageSummary>([
        ["apps/backend", mockSummary(85, 75, 80, 85)],
        ["packages/contracts", mockSummary(95, 90, 100, 95)],
      ]);
      const base = new Map<string, PackageCoverageSummary>([
        ["apps/backend", mockSummary(80, 80, 80, 80)],
        ["packages/contracts", mockSummary(90, 90, 95, 95)],
      ]);

      const deltas = computePackageDeltas(current, base, true);
      expect(deltas).toHaveLength(2);

      const backend = deltas.find((d) => d.packageName === "apps/backend");
      expect(backend).toBeDefined();
      expect(backend?.isAdded).toBe(false);
      expect(backend?.metrics.lines).toEqual({
        current: 85,
        base: 80,
        delta: 5,
      });
      expect(backend?.metrics.branches).toEqual({
        current: 75,
        base: 80,
        delta: -5,
      });
      expect(backend?.metrics.functions).toEqual({
        current: 80,
        base: 80,
        delta: 0,
      });
    });

    it("identifies newly added packages in PR", () => {
      const current = new Map<string, PackageCoverageSummary>([
        ["apps/backend", mockSummary(80, 80, 80, 80)],
        ["packages/new-package", mockSummary(100, 100, 100, 100)],
      ]);
      const base = new Map<string, PackageCoverageSummary>([
        ["apps/backend", mockSummary(80, 80, 80, 80)],
      ]);

      const deltas = computePackageDeltas(current, base, true);
      const newPkg = deltas.find(
        (d) => d.packageName === "packages/new-package",
      );
      expect(newPkg).toBeDefined();
      expect(newPkg?.isAdded).toBe(true);
      expect(newPkg?.metrics.lines).toEqual({
        current: 100,
        base: null,
        delta: null,
      });
    });

    it("handles base unavailable mode", () => {
      const current = new Map<string, PackageCoverageSummary>([
        ["apps/backend", mockSummary(80, 80, 80, 80)],
      ]);

      const deltas = computePackageDeltas(current, null, false);
      expect(deltas).toHaveLength(1);
      expect(deltas[0]?.isAdded).toBe(false);
      expect(deltas[0]?.metrics.lines).toEqual({
        current: 80,
        base: null,
        delta: null,
      });
    });

    it("matches package names without root prefixes", () => {
      const current = new Map<string, PackageCoverageSummary>([
        ["apps/backend", mockSummary(85, 80, 80, 80)],
      ]);
      const base = new Map<string, PackageCoverageSummary>([
        ["backend", mockSummary(80, 80, 80, 80)],
      ]);

      const deltas = computePackageDeltas(current, base, true);
      expect(deltas[0]?.isAdded).toBe(false);
      expect(deltas[0]?.metrics.lines.delta).toBe(5);
    });
  });

  describe("formatCoverageMarkdown", () => {
    it("formats markdown when no reports produced", () => {
      const markdown = formatCoverageMarkdown({
        packages: [],
        baseAvailable: true,
      });
      expect(markdown).toContain("| _no reports produced_ | | | | |");
    });

    it("includes warning note when base is unavailable", () => {
      const markdown = formatCoverageMarkdown({
        packages: [
          {
            packageName: "apps/backend",
            isAdded: false,
            metrics: {
              lines: { current: 80, base: null, delta: null },
              branches: { current: 80, base: null, delta: null },
              functions: { current: 80, base: null, delta: null },
              statements: { current: 80, base: null, delta: null },
            },
          },
        ],
        baseAvailable: false,
      });
      expect(markdown).toContain(
        "> Base coverage report unavailable for base branch. Showing current coverage only.",
      );
      expect(markdown).toContain("| `apps/backend` | 80% | 80% | 80% | 80% |");
    });

    it("formats delta markdown with base comparison and added packages", () => {
      const markdown = formatCoverageMarkdown({
        packages: [
          {
            packageName: "apps/backend",
            isAdded: false,
            metrics: {
              lines: { current: 85, base: 80, delta: 5 },
              branches: { current: 75, base: 80, delta: -5 },
              functions: { current: 80, base: 80, delta: 0 },
              statements: { current: 85, base: 80, delta: 5 },
            },
          },
          {
            packageName: "packages/new-tool",
            isAdded: true,
            metrics: {
              lines: { current: 90, base: null, delta: null },
              branches: { current: 90, base: null, delta: null },
              functions: { current: 90, base: null, delta: null },
              statements: { current: 90, base: null, delta: null },
            },
          },
        ],
        baseAvailable: true,
      });

      expect(markdown).not.toContain("Base coverage report unavailable");
      expect(markdown).toContain(
        "| `apps/backend` | 85% (base: 80%, +5%) | 75% (base: 80%, -5%) | 80% (base: 80%, 0%) | 85% (base: 80%, +5%) |",
      );
      expect(markdown).toContain(
        "| `packages/new-tool` | 90% (base: n/a) | 90% (base: n/a) | 90% (base: n/a) | 90% (base: n/a) |",
      );
    });
  });

  describe("parseCliArgs", () => {
    it("parses --base-dir and --current-dir flags", () => {
      const options = parseCliArgs([
        "--base-dir",
        "coverage/base",
        "--current-dir",
        "workspace",
      ]);
      expect(options).toEqual({
        baseDir: "coverage/base",
        currentDir: "workspace",
      });
    });

    it("parses equal-sign syntax (--base-dir=path)", () => {
      const options = parseCliArgs([
        "--base-dir=coverage/base",
        "--current-dir=./",
      ]);
      expect(options).toEqual({
        baseDir: "coverage/base",
        currentDir: "./",
      });
    });

    it("falls back to BASE_COVERAGE_DIR environment variable", () => {
      const options = parseCliArgs([], {
        BASE_COVERAGE_DIR: "coverage/fallback-base",
      });
      expect(options.baseDir).toBe("coverage/fallback-base");
      expect(options.currentDir).toBeUndefined();
    });

    it("gives priority to CLI flag over environment variable", () => {
      const options = parseCliArgs(["--base-dir", "coverage/override"], {
        BASE_COVERAGE_DIR: "coverage/fallback-base",
      });
      expect(options.baseDir).toBe("coverage/override");
    });
  });

  describe("parseCoverageSummaryJson", () => {
    it("parses valid coverage json", () => {
      const valid = JSON.stringify({
        total: {
          lines: { pct: 85, total: 100, covered: 85, skipped: 0 },
          branches: { pct: 75, total: 40, covered: 30, skipped: 0 },
          functions: { pct: 80, total: 50, covered: 40, skipped: 0 },
          statements: { pct: 85, total: 100, covered: 85, skipped: 0 },
        },
      });
      const parsed = parseCoverageSummaryJson(valid);
      expect(parsed?.total.lines.pct).toBe(85);
      expect(parsed?.total.branches.pct).toBe(75);
    });

    it("returns null on malformed or incomplete json", () => {
      expect(parseCoverageSummaryJson("invalid json")).toBeNull();
      expect(parseCoverageSummaryJson("{}")).toBeNull();
      expect(
        parseCoverageSummaryJson(
          JSON.stringify({
            total: {
              lines: { pct: 80 },
              // missing other metrics
            },
          }),
        ),
      ).toBeNull();
    });
  });

  describe("scanCoverageDirectory", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cov-test-"));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("scans nested coverage directories correctly", () => {
      const backendDir = path.join(tempDir, "apps", "backend", "coverage");
      fs.mkdirSync(backendDir, { recursive: true });
      fs.writeFileSync(
        path.join(backendDir, "coverage-summary.json"),
        JSON.stringify({
          total: {
            lines: { pct: 88 },
            branches: { pct: 82 },
            functions: { pct: 80 },
            statements: { pct: 88 },
          },
        }),
      );

      const results = scanCoverageDirectory(tempDir);
      expect(results.size).toBe(1);
      expect(results.has("apps/backend")).toBe(true);
      expect(results.get("apps/backend")?.total.lines.pct).toBe(88);
    });

    it("handles non-existent or empty directories gracefully", () => {
      const nonExistent = path.join(tempDir, "does-not-exist");
      const results = scanCoverageDirectory(nonExistent);
      expect(results.size).toBe(0);
    });
  });

  describe("generateCoverageReport", () => {
    it("generates complete report end-to-end", () => {
      const current = new Map<string, PackageCoverageSummary>([
        [
          "apps/backend",
          {
            total: {
              lines: { pct: 90 },
              branches: { pct: 80 },
              functions: { pct: 85 },
              statements: { pct: 90 },
            },
          },
        ],
      ]);
      const base = new Map<string, PackageCoverageSummary>([
        [
          "apps/backend",
          {
            total: {
              lines: { pct: 80 },
              branches: { pct: 80 },
              functions: { pct: 90 },
              statements: { pct: 80 },
            },
          },
        ],
      ]);

      const report = generateCoverageReport({
        currentSummaries: current,
        baseSummaries: base,
        baseAvailable: true,
      });

      expect(report.baseAvailable).toBe(true);
      expect(report.packages).toHaveLength(1);
      expect(report.markdown).toContain(
        "| `apps/backend` | 90% (base: 80%, +10%) | 80% (base: 80%, 0%) | 85% (base: 90%, -5%) | 90% (base: 80%, +10%) |",
      );
    });
  });
});
