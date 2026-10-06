import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../../src/schema";

describe("archive_ingest_jobs schema", () => {
  it("exports the table with expected columns", () => {
    expect(schema.archiveIngestJobs).toBeDefined();
    const config = getTableConfig(schema.archiveIngestJobs);
    const names = config.columns.map((c) => c.name);
    for (const col of [
      "id",
      "owner_id",
      "series_id",
      "source_key",
      "source_url",
      "status",
      "stage",
      "bytes_done",
      "bytes_total",
      "staging_path",
      "archive_filename",
      "entries",
      "selection",
      "storage_provider_id",
      "error_code",
      "error_message",
      "created_at",
      "updated_at",
      "expires_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  it("defines partial unique index on (owner_id, source_key) for active statuses", () => {
    const config = getTableConfig(schema.archiveIngestJobs);
    expect(config.indexes.length).toBeGreaterThan(0);
    const [index] = config.indexes;
    const colNames = index?.config.columns.map((c) => c.name) ?? [];
    expect(colNames).toContain("owner_id");
    expect(colNames).toContain("source_key");
    expect(index?.config.name).toContain("archive_ingest_jobs_owner_source_active_unique");
    expect(index?.config.where).toBeDefined();
  });
});
