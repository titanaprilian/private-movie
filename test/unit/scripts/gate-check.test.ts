import { describe, expect, it } from "vitest";
import {
  computeCloneFingerprint,
  computeEntryFingerprint,
  evaluateComplexityHotspots,
  evaluateDuplicationDelta,
  evaluateKnipFindings,
  evaluateKnipProcess,
  extractDuplicationFindings,
  extractKnipFindings,
  extractKnipFingerprints,
  formatDuplicationFinding,
  formatGitHubAnnotation,
  formatGitHubDuplicationAnnotation,
  formatKnipFinding,
  parseComplexityInventory,
  resolveMergeBase,
  type DuplicationFinding,
  type HotspotEntry,
  type JscpdClone,
  type JscpdReport,
  type KnipFinding,
  type KnipReport,
} from "../../../scripts/internal/gate-checker";

describe("gate-checker (Level L5 Zero-Tolerance)", () => {
  describe("computeEntryFingerprint", () => {
    it("formats named entry object", () => {
      const fp = computeEntryFingerprint("src/app.ts", "exports", {
        name: "myHandler",
      });
      expect(fp).toBe("src/app.ts:exports:myHandler");
    });

    it("formats array of named entry objects", () => {
      const fp = computeEntryFingerprint("src/app.ts", "exports", [
        { name: "foo" },
        { name: "bar" },
      ]);
      expect(fp).toBe("src/app.ts:exports:foo|bar");
    });

    it("formats primitive or unknown entry fallback", () => {
      const fp = computeEntryFingerprint(
        "package.json",
        "dependencies",
        "lodash",
      );
      expect(fp).toBe('package.json:dependencies:"lodash"');
    });
  });

  describe("extractKnipFingerprints", () => {
    it("extracts all category fingerprints across files", () => {
      const report: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/routes.ts",
            exports: [{ name: "unusedRoute" }],
            types: [{ name: "UnusedType" }],
          },
          {
            file: "packages/contracts/package.json",
            dependencies: [{ name: "unused-dep" }],
          },
        ],
      };

      const fingerprints = extractKnipFingerprints(report);
      expect(fingerprints.size).toBe(3);
      expect(
        fingerprints.has("apps/backend/src/routes.ts:exports:unusedRoute"),
      ).toBe(true);
      expect(
        fingerprints.has("apps/backend/src/routes.ts:types:UnusedType"),
      ).toBe(true);
      expect(
        fingerprints.has(
          "packages/contracts/package.json:dependencies:unused-dep",
        ),
      ).toBe(true);
    });

    it("handles empty or missing issues gracefully", () => {
      expect(extractKnipFingerprints({}).size).toBe(0);
      expect(extractKnipFingerprints({ issues: [] }).size).toBe(0);
    });
  });

  describe("extractKnipFindings", () => {
    it("extracts findings preserving line and col locations", () => {
      const report: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/routes.ts",
            exports: [{ name: "unusedRoute", line: 42, col: 14 }],
          },
          {
            file: "package.json",
            dependencies: [{ name: "unused-dep" }],
          },
        ],
      };

      const findings = extractKnipFindings(report);
      expect(findings).toHaveLength(2);
      expect(findings[0]).toEqual({
        file: "apps/backend/src/routes.ts",
        category: "exports",
        name: "unusedRoute",
        line: 42,
        col: 14,
        fingerprint: "apps/backend/src/routes.ts:exports:unusedRoute",
      });
      expect(findings[1]).toEqual({
        file: "package.json",
        category: "dependencies",
        name: "unused-dep",
        line: undefined,
        col: undefined,
        fingerprint: "package.json:dependencies:unused-dep",
      });
    });

    it("extracts nested findings such as duplicates", () => {
      const report: KnipReport = {
        issues: [
          {
            file: "src/types.ts",
            duplicates: [
              [
                { name: "dupA", line: 10, col: 5 },
                { name: "dupB", line: 20, col: 5 },
              ],
            ],
          },
        ],
      };

      const findings = extractKnipFindings(report);
      expect(findings).toHaveLength(2);
      expect(findings[0]?.name).toBe("dupA");
      expect(findings[0]?.line).toBe(10);
      expect(findings[1]?.name).toBe("dupB");
      expect(findings[1]?.line).toBe(20);
    });
  });

  describe("formatKnipFinding", () => {
    it("formats finding with file, line, col, category, and name", () => {
      const finding: KnipFinding = {
        file: "apps/backend/src/routes.ts",
        category: "exports",
        name: "unusedHandler",
        line: 45,
        col: 10,
        fingerprint: "apps/backend/src/routes.ts:exports:unusedHandler",
      };

      expect(formatKnipFinding(finding)).toBe(
        "apps/backend/src/routes.ts:45:10 [exports] unusedHandler",
      );
    });

    it("formats finding with file and line when col is absent", () => {
      const finding: KnipFinding = {
        file: "apps/web/src/view.tsx",
        category: "types",
        name: "ViewProps",
        line: 12,
        fingerprint: "apps/web/src/view.tsx:types:ViewProps",
      };

      expect(formatKnipFinding(finding)).toBe(
        "apps/web/src/view.tsx:12 [types] ViewProps",
      );
    });

    it("formats finding without line numbers cleanly", () => {
      const finding: KnipFinding = {
        file: "package.json",
        category: "dependencies",
        name: "lodash",
        fingerprint: "package.json:dependencies:lodash",
      };

      expect(formatKnipFinding(finding)).toBe(
        "package.json [dependencies] lodash",
      );
    });
  });

  describe("formatGitHubAnnotation", () => {
    it("emits GitHub Actions annotation when file and line are present", () => {
      const finding: KnipFinding = {
        file: "apps/backend/src/routes.ts",
        category: "exports",
        name: "unusedHandler",
        line: 45,
        col: 10,
        fingerprint: "apps/backend/src/routes.ts:exports:unusedHandler",
      };

      const annotation = formatGitHubAnnotation(finding);
      expect(annotation).toBe(
        "::error file=apps/backend/src/routes.ts,line=45,col=10,title=Knip [exports]::Unused export: unusedHandler",
      );
    });

    it("omits col when not present", () => {
      const finding: KnipFinding = {
        file: "apps/web/src/view.tsx",
        category: "types",
        name: "ViewProps",
        line: 12,
        fingerprint: "apps/web/src/view.tsx:types:ViewProps",
      };

      const annotation = formatGitHubAnnotation(finding);
      expect(annotation).toBe(
        "::error file=apps/web/src/view.tsx,line=12,title=Knip [types]::Unused type: ViewProps",
      );
    });

    it("returns null when line is missing or invalid", () => {
      const findingWithoutLine: KnipFinding = {
        file: "package.json",
        category: "dependencies",
        name: "lodash",
        fingerprint: "package.json:dependencies:lodash",
      };
      expect(formatGitHubAnnotation(findingWithoutLine)).toBeNull();

      const findingWithZeroLine: KnipFinding = {
        file: "package.json",
        category: "dependencies",
        name: "lodash",
        line: 0,
        fingerprint: "package.json:dependencies:lodash",
      };
      expect(formatGitHubAnnotation(findingWithZeroLine)).toBeNull();
    });

    it("returns null when file is missing", () => {
      const finding: KnipFinding = {
        file: "",
        category: "exports",
        name: "foo",
        line: 10,
        fingerprint: ":exports:foo",
      };
      expect(formatGitHubAnnotation(finding)).toBeNull();
    });
  });

  describe("evaluateKnipFindings (L5 Zero-Tolerance)", () => {
    it("passes when knip report has no issues (empty issues array)", () => {
      const report: KnipReport = {
        issues: [],
      };
      const result = evaluateKnipFindings(report);
      expect(result.passed).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.findings).toEqual([]);
    });

    it("passes when knip report has no issues property", () => {
      const report: KnipReport = {};
      const result = evaluateKnipFindings(report);
      expect(result.passed).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.findings).toEqual([]);
    });

    it("fails when any unused export or dependency is detected", () => {
      const report: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/routes.ts",
            exports: [{ name: "unusedRoute" }],
          },
          {
            file: "apps/web/package.json",
            dependencies: [{ name: "unused-pkg" }],
          },
        ],
      };

      const result = evaluateKnipFindings(report);
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.violations).toContain(
        "apps/backend/src/routes.ts:exports:unusedRoute",
      );
      expect(result.violations).toContain(
        "apps/web/package.json:dependencies:unused-pkg",
      );
    });

    it("detects violations across all knip categories", () => {
      const report: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/dead.ts",
            files: [{ name: "apps/backend/src/dead.ts" }],
            types: [{ name: "DeadType" }],
            enumMembers: [{ name: "DeadEnumMember" }],
            duplicates: [{ name: "duplicateExport" }],
          },
          {
            file: "package.json",
            devDependencies: [{ name: "unused-dev-dep" }],
            unlisted: [{ name: "unlisted-dep" }],
            unresolved: [{ name: "unresolved-import" }],
          },
        ],
      };

      const result = evaluateKnipFindings(report);
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(7);
      expect(result.violations).toContain(
        "apps/backend/src/dead.ts:files:apps/backend/src/dead.ts",
      );
      expect(result.violations).toContain(
        "apps/backend/src/dead.ts:types:DeadType",
      );
      expect(result.violations).toContain(
        "apps/backend/src/dead.ts:enumMembers:DeadEnumMember",
      );
      expect(result.violations).toContain(
        "apps/backend/src/dead.ts:duplicates:duplicateExport",
      );
      expect(result.violations).toContain(
        "package.json:devDependencies:unused-dev-dep",
      );
      expect(result.violations).toContain("package.json:unlisted:unlisted-dep");
      expect(result.violations).toContain(
        "package.json:unresolved:unresolved-import",
      );
    });
  });

  describe("evaluateKnipProcess (Fail-Closed & Process Execution Separation)", () => {
    it("passes when knip exits with status 0 and clean empty report", () => {
      const result = evaluateKnipProcess({
        status: 0,
        stdout: JSON.stringify({ issues: [] }),
        stderr: "",
      });
      expect(result.passed).toBe(true);
      expect(result.processError).toBeNull();
      expect(result.violations).toEqual([]);
      expect(result.findings).toEqual([]);
    });

    it("fails closed when nonzero knip status occurs even with parseable empty JSON", () => {
      // Simulates exit code 1 with empty JSON
      const resultEmpty = evaluateKnipProcess({
        status: 1,
        stdout: JSON.stringify({ issues: [] }),
        stderr: "Unexpected error during analysis",
      });
      expect(resultEmpty.passed).toBe(false);
      expect(resultEmpty.processError).toContain(
        "Knip process failed with exit code 1",
      );
      expect(resultEmpty.processError).toContain(
        "Unexpected error during analysis",
      );
      expect(resultEmpty.findings).toEqual([]);

      // Simulates exit code 2 with empty object JSON
      const resultExit2 = evaluateKnipProcess({
        status: 2,
        stdout: "{}",
        stderr: "Configuration load failure",
      });
      expect(resultExit2.passed).toBe(false);
      expect(resultExit2.processError).toContain(
        "Knip process failed with exit code 2",
      );
      expect(resultExit2.processError).toContain("Configuration load failure");
    });

    it("identifies standard finding failure without false process error when status is 1 with findings", () => {
      const result = evaluateKnipProcess({
        status: 1,
        stdout: JSON.stringify({
          issues: [
            {
              file: "apps/backend/src/index.ts",
              exports: [{ name: "deadHandler", line: 15, col: 3 }],
            },
          ],
        }),
        stderr: "",
      });
      expect(result.passed).toBe(false);
      expect(result.processError).toBeNull();
      expect(result.violations).toHaveLength(1);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]?.line).toBe(15);
    });

    it("reports both process error and findings when exit status indicates tool failure (e.g. status 2)", () => {
      const result = evaluateKnipProcess({
        status: 2,
        stdout: JSON.stringify({
          issues: [
            {
              file: "apps/web/src/App.tsx",
              types: [{ name: "DeadProp", line: 5 }],
            },
          ],
        }),
        stderr: "Unhandled rejection in plugin",
      });
      expect(result.passed).toBe(false);
      expect(result.processError).toContain(
        "Knip process exited with error status 2",
      );
      expect(result.processError).toContain("Unhandled rejection in plugin");
      expect(result.findings).toHaveLength(1);
      expect(result.violations).toHaveLength(1);
    });

    it("fails when execution error occurred during spawn", () => {
      const result = evaluateKnipProcess({
        status: null,
        error: new Error("spawn bunx ENOENT"),
      });
      expect(result.passed).toBe(false);
      expect(result.processError).toContain("spawn bunx ENOENT");
      expect(result.findings).toEqual([]);
    });

    it("fails when stdout contains malformed JSON", () => {
      const result = evaluateKnipProcess({
        status: 1,
        stdout: "Not JSON output",
        stderr: "Fatal error",
      });
      expect(result.passed).toBe(false);
      expect(result.processError).toContain("Failed to parse knip JSON output");
    });

    it("fails when process terminated abnormally (killed by signal)", () => {
      const result = evaluateKnipProcess({
        status: null,
        stdout: JSON.stringify({ issues: [] }),
      });
      expect(result.passed).toBe(false);
      expect(result.processError).toContain(
        "Knip process terminated abnormally",
      );
    });
  });

  describe("resolveMergeBase", () => {
    it("resolves valid git merge-base commit SHA", () => {
      const sha = resolveMergeBase();
      // In this repo, HEAD is valid and git is present
      if (sha) {
        expect(sha).toMatch(/^[0-9a-f]{40}$/);
      }
    });

    it("returns null or fallback when git command fails on invalid ref", () => {
      const sha = resolveMergeBase({
        baseRef: "non-existent-ref-12345",
        headRef: "invalid-head-67890",
      });
      expect(sha).toBeNull();
    });
  });

  describe("computeCloneFingerprint", () => {
    it("computes order-independent fingerprint for clone file pairs", () => {
      const clone1: JscpdClone = {
        firstFile: { name: "apps/web/src/compA.tsx" },
        secondFile: { name: "apps/backend/src/serviceB.ts" },
        lines: 20,
        tokens: 85,
        fragment: "function testDuplicate() { return 42; }",
      };

      const clone2: JscpdClone = {
        firstFile: { name: "apps/backend/src/serviceB.ts" },
        secondFile: { name: "apps/web/src/compA.tsx" },
        lines: 20,
        tokens: 85,
        fragment: "function testDuplicate() { return 42; }",
      };

      const fp1 = computeCloneFingerprint(clone1);
      const fp2 = computeCloneFingerprint(clone2);
      expect(fp1).toBe(fp2);
      expect(fp1).toContain(
        "apps/backend/src/serviceB.ts<=>apps/web/src/compA.tsx",
      );
      expect(fp1).toContain("85tok");
    });

    it("normalizes whitespace and newlines when fingerprinting fragments", () => {
      const cloneA: JscpdClone = {
        firstFile: { name: "src/a.ts" },
        secondFile: { name: "src/b.ts" },
        lines: 10,
        tokens: 50,
        fragment: "  const a = 1;\r\n  const b = 2;\n  ",
      };
      const cloneB: JscpdClone = {
        firstFile: { name: "src/a.ts" },
        secondFile: { name: "src/b.ts" },
        lines: 10,
        tokens: 50,
        fragment: "const a = 1;\nconst b = 2;",
      };
      expect(computeCloneFingerprint(cloneA)).toBe(
        computeCloneFingerprint(cloneB),
      );
    });
  });

  describe("extractDuplicationFindings", () => {
    it("identifies new vs unchanged clones against base report", () => {
      const baseClone: JscpdClone = {
        firstFile: {
          name: "src/old.ts",
          startLoc: { line: 10, column: 1 },
          endLoc: { line: 25, column: 1 },
        },
        secondFile: {
          name: "src/legacy.ts",
          startLoc: { line: 50, column: 1 },
          endLoc: { line: 65, column: 1 },
        },
        lines: 15,
        tokens: 70,
        fragment: "old duplicate block",
      };

      const newClone: JscpdClone = {
        firstFile: {
          name: "src/new.ts",
          startLoc: { line: 100, column: 5 },
          endLoc: { line: 120, column: 5 },
        },
        secondFile: {
          name: "src/another.ts",
          startLoc: { line: 200, column: 5 },
          endLoc: { line: 220, column: 5 },
        },
        lines: 20,
        tokens: 95,
        fragment: "brand new duplicated logic",
      };

      const baseReport: JscpdReport = {
        duplicates: [baseClone],
      };

      const headReport: JscpdReport = {
        duplicates: [baseClone, newClone],
      };

      const findings = extractDuplicationFindings(headReport, baseReport);
      expect(findings).toHaveLength(2);

      const oldFinding = findings.find(
        (f) => f.file1 === "src/old.ts" || f.file2 === "src/old.ts",
      );
      const newFinding = findings.find(
        (f) => f.file1 === "src/new.ts" || f.file2 === "src/new.ts",
      );

      expect(oldFinding?.isNew).toBe(false);
      expect(newFinding?.isNew).toBe(true);
      expect(newFinding?.lines).toBe(20);
      expect(newFinding?.tokens).toBe(95);
    });
  });

  describe("formatDuplicationFinding & formatGitHubDuplicationAnnotation", () => {
    const finding: DuplicationFinding = {
      file1: "apps/web/src/view.tsx",
      line1: 45,
      file2: "apps/backend/src/handler.ts",
      line2: 80,
      lines: 18,
      tokens: 90,
      fingerprint: "test-fp",
      isNew: true,
    };

    it("formats readable console output", () => {
      const output = formatDuplicationFinding(finding);
      expect(output).toBe(
        "apps/web/src/view.tsx:45 <=> apps/backend/src/handler.ts:80 [18 lines, 90 tokens]",
      );
    });

    it("formats GitHub Actions error annotation", () => {
      const annotation = formatGitHubDuplicationAnnotation(finding);
      expect(annotation).toBe(
        "::error file=apps/web/src/view.tsx,line=45,title=Duplication [jscpd]::New code duplication detected: 18 lines (90 tokens) duplicated with apps/backend/src/handler.ts:80",
      );
    });
  });

  describe("evaluateDuplicationDelta", () => {
    const existingClone: JscpdClone = {
      firstFile: { name: "src/a.ts", startLoc: { line: 10, column: 1 } },
      secondFile: { name: "src/b.ts", startLoc: { line: 20, column: 1 } },
      lines: 15,
      tokens: 75,
      fragment: "existing clone block",
    };

    const newClone: JscpdClone = {
      firstFile: { name: "src/c.ts", startLoc: { line: 1, column: 1 } },
      secondFile: { name: "src/d.ts", startLoc: { line: 1, column: 1 } },
      lines: 25,
      tokens: 120,
      fragment: "new clone block",
    };

    it("passes when head report matches base report and duplication rate is equal", () => {
      const report: JscpdReport = {
        duplicates: [existingClone],
        statistics: { total: { percentage: 0.95 } },
      };

      const result = evaluateDuplicationDelta({
        headReport: report,
        baseReport: report,
      });

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.newClones).toHaveLength(0);
    });

    it("fails when a new clone is introduced", () => {
      const baseReport: JscpdReport = {
        duplicates: [existingClone],
        statistics: { total: { percentage: 0.95 } },
      };

      const headReport: JscpdReport = {
        duplicates: [existingClone, newClone],
        statistics: { total: { percentage: 1.1 } },
      };

      const result = evaluateDuplicationDelta({
        headReport,
        baseReport,
      });

      expect(result.passed).toBe(false);
      expect(result.newClones).toHaveLength(1);
      expect(
        result.violations.some((v) =>
          v.includes("New duplication clone block detected"),
        ),
      ).toBe(true);
    });

    it("fails when overall duplication percentage increases even if clone count is unchanged", () => {
      const enlargedClone: JscpdClone = {
        ...existingClone,
        lines: 30,
        tokens: 150,
        fragment: "existing clone block enlarged with more lines",
      };

      const baseReport: JscpdReport = {
        duplicates: [existingClone],
        statistics: { total: { percentage: 0.95 } },
      };

      const headReport: JscpdReport = {
        duplicates: [enlargedClone],
        statistics: { total: { percentage: 1.25 } },
      };

      const result = evaluateDuplicationDelta({
        headReport,
        baseReport,
      });

      expect(result.passed).toBe(false);
      expect(
        result.violations.some((v) => v.includes("Duplication rate increased")),
      ).toBe(true);
    });

    it("passes when duplication is reduced (lower percentage, removed clones)", () => {
      const baseReport: JscpdReport = {
        duplicates: [existingClone, newClone],
        statistics: { total: { percentage: 1.2 } },
      };

      const headReport: JscpdReport = {
        duplicates: [existingClone],
        statistics: { total: { percentage: 0.8 } },
      };

      const result = evaluateDuplicationDelta({
        headReport,
        baseReport,
      });

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("falls back to absolute threshold when base report is absent", () => {
      const cleanReport: JscpdReport = {
        duplicates: [],
        statistics: { total: { percentage: 1.2 } },
      };
      const cleanResult = evaluateDuplicationDelta({
        headReport: cleanReport,
        baseReport: null,
        maxAbsoluteThreshold: 1.5,
      });
      expect(cleanResult.passed).toBe(true);

      const highReport: JscpdReport = {
        duplicates: [newClone],
        statistics: { total: { percentage: 1.8 } },
      };
      const highResult = evaluateDuplicationDelta({
        headReport: highReport,
        baseReport: null,
        maxAbsoluteThreshold: 1.5,
      });
      expect(highResult.passed).toBe(false);
      expect(
        highResult.violations.some((v) =>
          v.includes("exceeded absolute threshold"),
        ),
      ).toBe(true);
    });
  });

  describe("evaluateComplexityHotspots", () => {
    const hotspots: HotspotEntry[] = [
      {
        filePath: "apps/backend/src/modules/series/job.ts",
        functionName: "executeJobPipeline",
        maxComplexity: 42,
      },
      {
        filePath: "apps/web/src/components/VideoPlayer.tsx",
        functionName: "VideoPlayer",
        maxComplexity: 48,
      },
    ];

    it("passes when all measured functions are at or under their recorded threshold", () => {
      const mockMeasure = (filePath: string) => {
        if (filePath.includes("job.ts")) {
          return [{ functionName: "executeJobPipeline", complexity: 40 }];
        }
        return [{ functionName: "VideoPlayer", complexity: 48 }];
      };

      const result = evaluateComplexityHotspots(hotspots, mockMeasure);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("fails when a hotspot's complexity worsens beyond its recorded baseline", () => {
      const mockMeasure = (filePath: string) => {
        if (filePath.includes("job.ts")) {
          return [{ functionName: "executeJobPipeline", complexity: 45 }]; // baseline 42 -> 45
        }
        return [{ functionName: "VideoPlayer", complexity: 48 }];
      };

      const result = evaluateComplexityHotspots(hotspots, mockMeasure);
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain(
        "apps/backend/src/modules/series/job.ts:executeJobPipeline exceeded baseline complexity of 42 (measured 45)",
      );
    });
  });

  describe("parseComplexityInventory", () => {
    it("parses inventory markdown into structured entries", () => {
      const markdown = `
### Backend (\`apps/backend\`)

| File Path | Function / Scope | Cyclomatic Complexity | Calibrated Override |
| --- | --- | :---: | :---: |
| \`src/modules/series/job.ts\` | \`executeJobPipeline\` | 42 | 50 |

### Web Frontend (\`apps/web\`)

| File Path | Function / Scope | Cyclomatic Complexity | Calibrated Override |
| --- | --- | :---: | :---: |
| \`src/components/VideoPlayer.tsx\` | \`VideoPlayer\` | 48 | 50 |
`;

      const entries = parseComplexityInventory(markdown);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({
        filePath: "apps/backend/src/modules/series/job.ts",
        functionName: "executeJobPipeline",
        maxComplexity: 42,
      });
      expect(entries[1]).toEqual({
        filePath: "apps/web/src/components/VideoPlayer.tsx",
        functionName: "VideoPlayer",
        maxComplexity: 48,
      });
    });
  });
});
