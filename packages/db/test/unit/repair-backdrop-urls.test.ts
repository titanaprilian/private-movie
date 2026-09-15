import { describe, it, expect, vi } from "vitest";
import { repairBackdropUrls } from "../../src/repair-backdrop-urls";

describe("repairBackdropUrls", () => {
  it("executes expected SQL string replacement and returns updated count", async () => {
    let capturedSql: any = null;

    const mockDb = {
      execute: vi.fn().mockImplementation((query: any) => {
        capturedSql = query;
        return Promise.resolve({ rowCount: 3 });
      }),
    } as any;

    const result = await repairBackdropUrls(mockDb);

    expect(mockDb.execute).toHaveBeenCalledTimes(1);
    expect(result.updatedCount).toBe(3);

    const queryChunks = capturedSql?.queryChunks || [];
    const fullSql = queryChunks.map((c: any) => (typeof c === "string" ? c : c?.value?.join("") || "")).join(" ");
    expect(fullSql).toContain("UPDATE series SET backdrop_url = REPLACE(backdrop_url, '/t/p/w500/', '/t/p/original/')");
    expect(fullSql).toContain("WHERE backdrop_url LIKE '%image.tmdb.org/t/p/w500/%'");
  });

  it("handles result shapes without rowCount gracefully", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] }),
    } as any;

    const result = await repairBackdropUrls(mockDb);

    expect(result.updatedCount).toBe(2);
  });
});
