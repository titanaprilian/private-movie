import { describe, expect, it, vi } from "vitest";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { createOngoingScraperService } from "../../../src/internal/ongoing/service";
import { SeasonNotFoundError } from "../../../src/internal/seasons/repository";
import type { SeasonsRepository } from "../../../src/internal/seasons/repository";
import type { SeasonRow } from "@repo/db";

describe("createOngoingScraperService (unit boundaries)", () => {
  const dummyDb = {} as unknown as PgDatabase<never, Record<string, unknown>>;

  it("throws SeasonNotFoundError if target season is missing", async () => {
    const mockSeasonsRepo = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as SeasonsRepository;

    const service = createOngoingScraperService(dummyDb, {
      seasonsRepository: mockSeasonsRepo,
    });

    await expect(
      service.syncAndScrapeOngoingSeason("missing-season-id"),
    ).rejects.toThrow(SeasonNotFoundError);
  });

  it("returns error result and records lastScrapeError when season is not ongoing", async () => {
    const seasonRow: SeasonRow = {
      id: "s-1",
      seriesId: "series-1",
      title: "Season 1",
      description: null,
      posterUrl: null,
      seasonNumber: 1,
      status: "completed",
      scraperUrl: "https://otakudesu.cloud/anime/s1",
      source: "otakudesu",
      episodeOffset: 0,
      lastScrapedAt: null,
      lastScrapeError: null,
      tmdbSyncStatus: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updateSeason = vi.fn().mockResolvedValue(seasonRow);
    const mockSeasonsRepo = {
      findById: vi.fn().mockResolvedValue(seasonRow),
      updateSeason,
    } as unknown as SeasonsRepository;

    const service = createOngoingScraperService(dummyDb, {
      seasonsRepository: mockSeasonsRepo,
    });

    const result = await service.syncAndScrapeOngoingSeason("s-1");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not in ongoing status/i);
    expect(updateSeason).toHaveBeenCalledWith(
      "s-1",
      expect.objectContaining({
        lastScrapeError: expect.stringMatching(/not in ongoing status/i),
      }),
    );
  });

  it("returns error result when scraperUrl is missing", async () => {
    const seasonRow: SeasonRow = {
      id: "s-1",
      seriesId: "series-1",
      title: "Season 1",
      description: null,
      posterUrl: null,
      seasonNumber: 1,
      status: "ongoing",
      scraperUrl: null,
      source: "otakudesu",
      episodeOffset: 0,
      lastScrapedAt: null,
      lastScrapeError: null,
      tmdbSyncStatus: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updateSeason = vi.fn().mockResolvedValue(seasonRow);
    const mockSeasonsRepo = {
      findById: vi.fn().mockResolvedValue(seasonRow),
      updateSeason,
    } as unknown as SeasonsRepository;

    const service = createOngoingScraperService(dummyDb, {
      seasonsRepository: mockSeasonsRepo,
    });

    const result = await service.syncAndScrapeOngoingSeason("s-1");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/missing scraperUrl or source/i);
    expect(updateSeason).toHaveBeenCalledWith(
      "s-1",
      expect.objectContaining({
        lastScrapeError: expect.stringMatching(/missing scraperUrl or source/i),
      }),
    );
  });
});
