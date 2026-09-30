import { describe, it, expect, vi } from "vitest";
import { backfillEpisodePassports } from "../../src/backfill-episode-passports";

function extractSql(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];
  return chunks
    .map((c) => (typeof c === "string" ? c : ((c as { value?: string[] })?.value?.join("") ?? "")))
    .join(" ");
}

describe("backfillEpisodePassports", () => {
  it("runs a single atomic UPDATE joining seasons and returns updatedCount", async () => {
    let captured: unknown = null;
    const mockDb = {
      execute: vi.fn().mockImplementation((q: unknown) => {
        captured = q;
        return Promise.resolve({ rowCount: 5 });
      }),
    } as never;

    const result = await backfillEpisodePassports(mockDb);

    expect(mockDb.execute).toHaveBeenCalledTimes(1);
    expect(result.updatedCount).toBe(5);

    const fullSql = extractSql(captured);
    expect(fullSql).toContain("UPDATE episodes");
    expect(fullSql).toContain("tmdb_season_number = COALESCE(seasons.season_number, 1)");
    expect(fullSql).toContain('tmdb_episode_number = episodes."order"');
    expect(fullSql).toContain("episodes.season_id = seasons.id");
    expect(fullSql).toContain("episodes.tmdb_season_number IS NULL");
    expect(fullSql).toContain("episodes.tmdb_episode_number IS NULL");
  });

  it("only touches rows with NULL passport numbers (idempotency guard)", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
    } as never;

    const result = await backfillEpisodePassports(mockDb);

    expect(result.updatedCount).toBe(0);
    const fullSql = extractSql((mockDb.execute as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    // OR condition covers either column being NULL; rows with both set are excluded.
    expect(fullSql).toMatch(/tmdb_season_number IS NULL OR/i);
  });

  it("handles result shapes without rowCount gracefully", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rows: [{}, {}, {}] }),
    } as never;

    const result = await backfillEpisodePassports(mockDb);

    expect(result.updatedCount).toBe(3);
  });

  it("reads postgres.js write count property", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ count: 7 }),
    } as never;

    const result = await backfillEpisodePassports(mockDb);

    expect(result.updatedCount).toBe(7);
  });
});
