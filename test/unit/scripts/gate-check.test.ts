import { describe, expect, it } from "vitest";
import {
  compareKnipFindings,
  computeEntryFingerprint,
  extractKnipFingerprints,
  pruneKnipBaseline,
  type KnipReport,
} from "../../../scripts/internal/gate-checker";

describe("gate-checker", () => {
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

  describe("compareKnipFindings", () => {
    it("passes when debt is unchanged (exact match with baseline)", () => {
      const baseline: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacyUnused" }],
          },
        ],
      };
      const current: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacyUnused" }],
          },
        ],
      };

      const result = compareKnipFindings(current, baseline);
      expect(result.passed).toBe(true);
      expect(result.newViolations).toEqual([]);
      expect(result.resolvedCount).toBe(0);
      expect(result.resolvedFingerprints).toEqual([]);
    });

    it("fails when newly introduced debt is detected", () => {
      const baseline: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacyUnused" }],
          },
        ],
      };
      const current: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacyUnused" }, { name: "brandNewUnused" }],
          },
        ],
      };

      const result = compareKnipFindings(current, baseline);
      expect(result.passed).toBe(false);
      expect(result.newViolations).toEqual([
        "apps/backend/src/index.ts:exports:brandNewUnused",
      ]);
      expect(result.resolvedCount).toBe(0);
    });

    it("detects resolved debt and reports progress", () => {
      const baseline: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacyUnused" }, { name: "cleanedUpExport" }],
          },
        ],
      };
      const current: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacyUnused" }],
          },
        ],
      };

      const result = compareKnipFindings(current, baseline);
      expect(result.passed).toBe(true);
      expect(result.newViolations).toEqual([]);
      expect(result.resolvedCount).toBe(1);
      expect(result.resolvedFingerprints).toEqual([
        "apps/backend/src/index.ts:exports:cleanedUpExport",
      ]);
    });

    it("fails when both resolved debt and new debt are present", () => {
      const baseline: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "cleanedUpExport" }],
          },
        ],
      };
      const current: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "newUnused" }],
          },
        ],
      };

      const result = compareKnipFindings(current, baseline);
      expect(result.passed).toBe(false);
      expect(result.newViolations).toEqual([
        "apps/backend/src/index.ts:exports:newUnused",
      ]);
      expect(result.resolvedCount).toBe(1);
    });
  });

  describe("pruneKnipBaseline (Ratchet Enforcement)", () => {
    it("prunes resolved findings and removes empty file entries", () => {
      const baseline: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacy1" }, { name: "cleanedUp" }],
            types: [{ name: "typeCleanedUp" }],
          },
          {
            file: "apps/web/src/obsolete.ts",
            files: [{ name: "apps/web/src/obsolete.ts" }],
          },
        ],
      };

      // In current: "cleanedUp", "typeCleanedUp", and "apps/web/src/obsolete.ts" are resolved
      const current: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacy1" }],
          },
        ],
      };

      const result = pruneKnipBaseline(current, baseline);
      expect(result.success).toBe(true);
      expect(result.prunedCount).toBe(3);
      expect(result.prunedReport).toBeDefined();

      const prunedIssues = result.prunedReport!.issues!;
      expect(prunedIssues.length).toBe(1);
      expect(prunedIssues[0].file).toBe("apps/backend/src/index.ts");
      expect(prunedIssues[0].exports).toEqual([{ name: "legacy1" }]);
      expect(prunedIssues[0].types).toEqual([]);
    });

    it("refuses to prune or update baseline when new violations exist (ratchet guard)", () => {
      const baseline: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacy1" }],
          },
        ],
      };

      // Current introduces a new violation "newViolatingFunc"
      const current: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacy1" }, { name: "newViolatingFunc" }],
          },
        ],
      };

      const result = pruneKnipBaseline(current, baseline);
      expect(result.success).toBe(false);
      expect(result.prunedReport).toBeNull();
      expect(result.newViolations).toEqual([
        "apps/backend/src/index.ts:exports:newViolatingFunc",
      ]);
    });

    it("returns unmodified baseline if no findings were resolved", () => {
      const baseline: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacy1" }],
          },
        ],
      };
      const current: KnipReport = {
        issues: [
          {
            file: "apps/backend/src/index.ts",
            exports: [{ name: "legacy1" }],
          },
        ],
      };

      const result = pruneKnipBaseline(current, baseline);
      expect(result.success).toBe(true);
      expect(result.prunedCount).toBe(0);
      expect(result.prunedReport!.issues!.length).toBe(1);
    });
  });
});
