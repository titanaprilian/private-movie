import { describe, expect, it } from "vitest";
import {
  computeEntryFingerprint,
  evaluateKnipFindings,
  extractKnipFingerprints,
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

  describe("evaluateKnipFindings (L5 Zero-Tolerance)", () => {
    it("passes when knip report has no issues (empty issues array)", () => {
      const report: KnipReport = {
        issues: [],
      };
      const result = evaluateKnipFindings(report);
      expect(result.passed).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it("passes when knip report has no issues property", () => {
      const report: KnipReport = {};
      const result = evaluateKnipFindings(report);
      expect(result.passed).toBe(true);
      expect(result.violations).toEqual([]);
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
});
