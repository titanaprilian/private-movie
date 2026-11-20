import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("database migration recovery runbook & verification", () => {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const runbookPath = path.join(
    repoRoot,
    "docs/runbooks/database-migration-recovery.md",
  );
  const dbAgentsMdPath = path.join(repoRoot, "packages/db/AGENTS.md");
  const dbReadmePath = path.join(repoRoot, "packages/db/README.md");

  describe("runbook documentation & required sections", () => {
    it("ensures database-migration-recovery.md exists", () => {
      expect(fs.existsSync(runbookPath)).toBe(true);
    });

    it("covers core invariants: agent prohibition and human approval boundary", () => {
      const content = fs.readFileSync(runbookPath, "utf-8");

      expect(content).toContain("Human Approval Boundary");
      expect(content).toContain("Agent Migration Prohibition");
      expect(content).toMatch(/db:push/);
      expect(content).toMatch(/db:migrate/);
      expect(content).toMatch(/human operator/i);
    });

    it("covers pre-deployment safeguards and pg_dump snapshot requirement", () => {
      const content = fs.readFileSync(runbookPath, "utf-8");

      expect(content).toContain("Pre-Deployment Safeguards");
      expect(content).toMatch(/pg_dump/);
      expect(content).toMatch(/-F\s+c/); // custom format binary snapshot
    });

    it("covers Failure Mode 1: Failure Before Application Rollout", () => {
      const content = fs.readFileSync(runbookPath, "utf-8");

      expect(content).toContain(
        "Failure Mode 1: Migration Failure Before Application Rollout",
      );
      expect(content).toContain("Roll-Forward");
      expect(content).toContain("Abort Deployment");
      expect(content).toContain("PREV_SHA");
    });

    it("covers Failure Mode 2: Failure After Application Rollout", () => {
      const content = fs.readFileSync(runbookPath, "utf-8");

      expect(content).toContain(
        "Failure Mode 2: Application Failure After Migration Rollout",
      );
      expect(content).toContain("Phase 1");
      expect(content).toContain("Phase 3");
      expect(content).toContain("pg_restore");
    });

    it("documents the distinction between additive zero-downtime rollback and snapshot restore", () => {
      const content = fs.readFileSync(runbookPath, "utf-8");

      // In Phase 1 (additive), app containers are rolled back without DB schema rollback
      expect(content).toMatch(/DO NOT ROLL BACK DATABASE SCHEMA/i);
      // In Phase 3 (contract / destructive), snapshot restore is required
      expect(content).toMatch(/FULL RECOVERY & SNAPSHOT RESTORE/i);
    });

    it("includes the infrastructure and responsibility matrix", () => {
      const content = fs.readFileSync(runbookPath, "utf-8");

      expect(content).toContain("Infrastructure & Responsibility Matrix");
      expect(content).toContain("Human Operator");
      expect(content).toContain("AI Agent");
    });
  });

  describe("database instruction cross-links", () => {
    it("packages/db/AGENTS.md references the recovery runbook and affirms human ownership", () => {
      const content = fs.readFileSync(dbAgentsMdPath, "utf-8");

      expect(content).toContain("database-migration-recovery.md");
      expect(content).toContain("Deployment Recovery & Operational Runbooks");
      expect(content).toMatch(/human operator/i);
      expect(content).toMatch(
        /agents must never run migration or push commands/i,
      );
    });

    it("packages/db/README.md references the recovery runbook", () => {
      const content = fs.readFileSync(dbReadmePath, "utf-8");

      expect(content).toContain("database-migration-recovery.md");
      expect(content).toContain("Deployment Recovery");
    });
  });

  describe("isolated simulation: backward compatibility of additive schema changes", () => {
    interface LegacyRow {
      id: string;
      title: string;
    }

    interface ExpandedRow extends LegacyRow {
      display_order?: number | null;
      status?: string;
    }

    it("demonstrates that additive schema changes preserve legacy query compatibility", () => {
      // Simulating a database row before expansion
      const preExpansionRow: LegacyRow = { id: "1", title: "Media Title" };

      // Simulating a database row after Phase 1 Expand (nullable column or default)
      const postExpansionRow: ExpandedRow = {
        ...preExpansionRow,
        display_order: null,
        status: "active",
      };

      // A legacy query reader querying only legacy fields functions without failure on expanded data
      const legacyReader = (row: LegacyRow): { id: string; title: string } => ({
        id: row.id,
        title: row.title,
      });

      expect(legacyReader(postExpansionRow)).toEqual({
        id: "1",
        title: "Media Title",
      });
    });

    it("simulates transaction rollback preventing dirty state on migration abort", () => {
      const state = { appliedMigrations: ["0001", "0002"] };

      const simulateMigrationStep = (
        nextMigration: string,
        shouldFail: boolean,
      ) => {
        const pendingState = [...state.appliedMigrations];
        try {
          if (shouldFail) {
            throw new Error(`Migration ${nextMigration} syntax error`);
          }
          pendingState.push(nextMigration);
          state.appliedMigrations = pendingState;
        } catch {
          // Transaction aborts; pendingState discarded
        }
      };

      simulateMigrationStep("0003", true);

      // Asserts state remained untouched
      expect(state.appliedMigrations).toEqual(["0001", "0002"]);
      expect(state.appliedMigrations).not.toContain("0003");
    });
  });

  describe("operator infrastructure boundary validation", () => {
    it("specifies exact operator infrastructure commands and tools", () => {
      const content = fs.readFileSync(runbookPath, "utf-8");

      const requiredCommands = [
        "docker compose exec -T db pg_dump",
        "docker compose exec -T db pg_restore",
        "docker compose up -d",
        "curl -f http://localhost:3000/api/health",
      ];

      for (const cmd of requiredCommands) {
        expect(content).toContain(cmd);
      }
    });

    it("strictly prohibits automated agent execution of production migration commands", () => {
      const forbiddenForAgents = ["db:push", "db:migrate"];
      const content = fs.readFileSync(runbookPath, "utf-8");

      for (const tool of forbiddenForAgents) {
        expect(content).toMatch(new RegExp(`FORBIDDEN.*${tool}`));
      }
    });
  });
});
