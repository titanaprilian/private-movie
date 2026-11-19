import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkStatement,
  evaluateMigrations,
  isValidRationale,
  parseSqlStatements,
  resolveMigrationFilesToCheck,
} from "../../../scripts/internal/migration-checker";

describe("migration-checker", () => {
  describe("isValidRationale", () => {
    it("accepts rationale with 3 or more non-whitespace characters", () => {
      expect(isValidRationale("yes")).toBe(true);
      expect(isValidRationale("dropping legacy table")).toBe(true);
      expect(isValidRationale("   abc   ")).toBe(true);
    });

    it("rejects empty, undefined, or whitespace-only rationale", () => {
      expect(isValidRationale(undefined)).toBe(false);
      expect(isValidRationale("")).toBe(false);
      expect(isValidRationale("   ")).toBe(false);
      expect(isValidRationale("\t\n")).toBe(false);
    });

    it("rejects rationale with fewer than 3 non-whitespace characters", () => {
      expect(isValidRationale("a")).toBe(false);
      expect(isValidRationale("no")).toBe(false);
      expect(isValidRationale("  ok  ")).toBe(false);
    });
  });

  describe("parseSqlStatements & checkStatement", () => {
    it("passes clean migrations with CREATE TABLE and CREATE INDEX", () => {
      const sql = `
CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);--> statement-breakpoint
CREATE INDEX "users_name_idx" ON "users" ("name");
`;
      const stmts = parseSqlStatements(sql, "0001_clean.sql");
      expect(stmts).toHaveLength(2);

      const v1 = checkStatement(stmts[0]);
      const v2 = checkStatement(stmts[1]);
      expect(v1).toHaveLength(0);
      expect(v2).toHaveLength(0);
    });

    it("fails on DROP TABLE without bypass", () => {
      const sql = `DROP TABLE "obsolete_users";`;
      const stmts = parseSqlStatements(sql, "0002_drop.sql");
      expect(stmts).toHaveLength(1);

      const violations = checkStatement(stmts[0]);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("drop-table");
      expect(violations[0].line).toBe(1);
      expect(violations[0].statement).toContain("DROP TABLE");
      expect(violations[0].remediation).toContain(
        "Dropping tables breaks running application instances",
      );
    });

    it("fails on DROP TABLE IF EXISTS CASCADE without bypass", () => {
      const sql = `DROP TABLE IF EXISTS "old_cache" CASCADE;`;
      const stmts = parseSqlStatements(sql, "0003_drop_cascade.sql");
      const violations = checkStatement(stmts[0]);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("drop-table");
    });

    it("fails on DROP COLUMN without bypass", () => {
      const sql = `ALTER TABLE "users" DROP COLUMN "avatar_url";`;
      const stmts = parseSqlStatements(sql, "0004_drop_col.sql");
      expect(stmts).toHaveLength(1);

      const violations = checkStatement(stmts[0]);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("drop-column");
      expect(violations[0].line).toBe(1);
      expect(violations[0].statement).toContain("DROP COLUMN");
      expect(violations[0].remediation).toContain(
        "Dropping columns causes runtime errors",
      );
    });

    it("fails on DROP COLUMN IF EXISTS without bypass", () => {
      const sql = `ALTER TABLE "users" DROP COLUMN IF EXISTS "bio";`;
      const stmts = parseSqlStatements(sql, "0005_drop_col_if_exists.sql");
      const violations = checkStatement(stmts[0]);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("drop-column");
    });

    it("does not flag ALTER TABLE ... DROP CONSTRAINT", () => {
      const sql = `ALTER TABLE "users" DROP CONSTRAINT "users_email_key";`;
      const stmts = parseSqlStatements(sql, "0006_drop_constraint.sql");
      const violations = checkStatement(stmts[0]);
      expect(violations).toHaveLength(0);
    });

    it("fails on ALTER TABLE ... ADD COLUMN with NOT NULL without DEFAULT", () => {
      const sql = `ALTER TABLE "users" ADD COLUMN "email" text NOT NULL;`;
      const stmts = parseSqlStatements(sql, "0007_unhedged.sql");
      expect(stmts).toHaveLength(1);

      const violations = checkStatement(stmts[0]);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("unhedged-add-column");
      expect(violations[0].line).toBe(1);
      expect(violations[0].statement).toContain("ADD COLUMN");
      expect(violations[0].remediation).toContain(
        "Adding a NOT NULL column without a DEFAULT clause",
      );
    });

    it("passes on ALTER TABLE ... ADD COLUMN with nullable column", () => {
      const sql = `ALTER TABLE "users" ADD COLUMN "bio" text;`;
      const stmts = parseSqlStatements(sql, "0008_nullable.sql");
      const violations = checkStatement(stmts[0]);
      expect(violations).toHaveLength(0);
    });

    it("passes on ALTER TABLE ... ADD COLUMN with DEFAULT and NOT NULL", () => {
      const sql1 = `ALTER TABLE "users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;`;
      const stmts1 = parseSqlStatements(sql1, "0009_default_first.sql");
      expect(checkStatement(stmts1[0])).toHaveLength(0);

      const sql2 = `ALTER TABLE "users" ADD COLUMN "status" text NOT NULL DEFAULT 'active';`;
      const stmts2 = parseSqlStatements(sql2, "0010_default_second.sql");
      expect(checkStatement(stmts2[0])).toHaveLength(0);
    });

    it("passes on ALTER TABLE ... ADD CONSTRAINT", () => {
      const sql = `ALTER TABLE "users" ADD CONSTRAINT "users_role_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id");`;
      const stmts = parseSqlStatements(sql, "0011_add_constraint.sql");
      expect(checkStatement(stmts[0])).toHaveLength(0);
    });

    it("bypasses DROP TABLE when valid -- allow-destructive rationale is provided", () => {
      const sql = `
-- allow-destructive: Table replaced by seasons table in 0014
DROP TABLE "series_relations" CASCADE;
`;
      const stmts = parseSqlStatements(sql, "0012_bypassed_table.sql");
      expect(stmts).toHaveLength(1);
      expect(stmts[0].hasDestructiveBypass).toBe(true);
      expect(checkStatement(stmts[0])).toHaveLength(0);
    });

    it("bypasses DROP COLUMN when valid -- allow-destructive rationale is provided", () => {
      const sql = `
-- allow-destructive: Removed from application queries in release v1.4
ALTER TABLE "episodes" DROP COLUMN "source_url";
`;
      const stmts = parseSqlStatements(sql, "0013_bypassed_col.sql");
      expect(stmts).toHaveLength(1);
      expect(stmts[0].hasDestructiveBypass).toBe(true);
      expect(checkStatement(stmts[0])).toHaveLength(0);
    });

    it("bypasses unhedged ADD COLUMN when valid -- allow-destructive rationale is provided", () => {
      const sql = `
-- allow-destructive: Table is verified empty before adding mandatory column
ALTER TABLE "temporary_staging" ADD COLUMN "batch_id" text NOT NULL;
`;
      const stmts = parseSqlStatements(sql, "0014_bypassed_add.sql");
      expect(stmts).toHaveLength(1);
      expect(stmts[0].hasDestructiveBypass).toBe(true);
      expect(checkStatement(stmts[0])).toHaveLength(0);
    });

    it("fails when -- allow-destructive has empty or whitespace-only rationale", () => {
      const sql1 = `
-- allow-destructive:
DROP TABLE "users";
`;
      const stmts1 = parseSqlStatements(sql1, "0015_empty_rationale.sql");
      expect(stmts1[0].hasDestructiveBypass).toBe(false);
      expect(checkStatement(stmts1[0])).toHaveLength(1);

      const sql2 = `
-- allow-destructive:   
DROP TABLE "users";
`;
      const stmts2 = parseSqlStatements(sql2, "0016_ws_rationale.sql");
      expect(stmts2[0].hasDestructiveBypass).toBe(false);
      expect(checkStatement(stmts2[0])).toHaveLength(1);

      const sql3 = `
-- allow-destructive: no
DROP TABLE "users";
`;
      const stmts3 = parseSqlStatements(sql3, "0017_short_rationale.sql");
      expect(stmts3[0].hasDestructiveBypass).toBe(false);
      expect(checkStatement(stmts3[0])).toHaveLength(1);
    });

    it("does not trigger on destructive keywords inside string literals or comments", () => {
      const sql = `
-- DROP TABLE fake_table
INSERT INTO "audit_logs" ("action") VALUES ('DROP TABLE was executed by admin');--> statement-breakpoint
SELECT 'ALTER TABLE t DROP COLUMN col' AS msg;
`;
      const stmts = parseSqlStatements(sql, "0018_strings_and_comments.sql");
      expect(stmts).toHaveLength(2);
      expect(checkStatement(stmts[0])).toHaveLength(0);
      expect(checkStatement(stmts[1])).toHaveLength(0);
    });

    it("handles multi-statement files with --> statement-breakpoint accurately", () => {
      const sql = `
CREATE TABLE "temp_a" ("id" text PRIMARY KEY NOT NULL);--> statement-breakpoint
-- allow-destructive: Dropping old table A
DROP TABLE "old_a";--> statement-breakpoint
DROP TABLE "old_b";--> statement-breakpoint
ALTER TABLE "temp_a" ADD COLUMN "name" text;
`;
      const stmts = parseSqlStatements(sql, "0019_multi.sql");
      expect(stmts).toHaveLength(4);

      // stmt 0: CREATE TABLE -> clean
      expect(checkStatement(stmts[0])).toHaveLength(0);

      // stmt 1: DROP TABLE old_a -> bypassed
      expect(stmts[1].hasDestructiveBypass).toBe(true);
      expect(checkStatement(stmts[1])).toHaveLength(0);

      // stmt 2: DROP TABLE old_b -> un-bypassed violation!
      expect(stmts[2].hasDestructiveBypass).toBe(false);
      const v2 = checkStatement(stmts[2]);
      expect(v2).toHaveLength(1);
      expect(v2[0].rule).toBe("drop-table");
      expect(v2[0].statement).toContain('DROP TABLE "old_b"');

      // stmt 3: ADD COLUMN nullable -> clean
      expect(checkStatement(stmts[3])).toHaveLength(0);
    });
  });

  describe("evaluateMigrations", () => {
    it("evaluates a list of real files returning pass/fail and violations", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-test-"));
      try {
        const cleanFile = path.join(tmpDir, "0001_clean.sql");
        const badFile = path.join(tmpDir, "0002_bad.sql");

        fs.writeFileSync(
          cleanFile,
          'CREATE TABLE "items" ("id" text PRIMARY KEY NOT NULL);\n',
        );
        fs.writeFileSync(
          badFile,
          'ALTER TABLE "items" ADD COLUMN "mandatory" text NOT NULL;\n',
        );

        const cleanResult = evaluateMigrations([cleanFile]);
        expect(cleanResult.passed).toBe(true);
        expect(cleanResult.violations).toHaveLength(0);
        expect(cleanResult.scannedFiles).toEqual([cleanFile]);

        const combinedResult = evaluateMigrations([cleanFile, badFile]);
        expect(combinedResult.passed).toBe(false);
        expect(combinedResult.violations).toHaveLength(1);
        expect(combinedResult.violations[0].rule).toBe("unhedged-add-column");
        expect(combinedResult.violations[0].file).toBe(badFile);
        expect(combinedResult.scannedFiles).toEqual([cleanFile, badFile]);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("resolveMigrationFilesToCheck", () => {
    it("returns all packages/db/drizzle/*.sql files when all: true", () => {
      const files = resolveMigrationFilesToCheck({ all: true });
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        expect(f).toMatch(/^packages\/db\/drizzle\/.+\.sql$/);
      }
    });

    it("returns git diff added/modified files when all is false/omitted", () => {
      // In current branch against main, resolveMigrationFilesToCheck should return an array
      const files = resolveMigrationFilesToCheck();
      expect(Array.isArray(files)).toBe(true);
    });

    it("handles non-existent drizzle directory gracefully", () => {
      const files = resolveMigrationFilesToCheck({
        all: true,
        cwd: "/non/existent/path",
      });
      expect(files).toEqual([]);
    });
  });
});
