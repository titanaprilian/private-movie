import { beforeEach, describe, expect, it, vi } from "vitest";
import { episodes, seasons, series } from "@repo/db";
import { createSeasonRepository } from "@/modules/seasons/internal/repository";
import { createSeasonService } from "@/modules/seasons/internal/service";
import {
  SeasonMissingScraperUrlError,
  SeasonNotFoundError,
  SeasonNotOngoingError,
} from "@/modules/seasons/internal/errors";
import { db } from "../../utils/db";
import type { ScrapeSeasonDelegate } from "@/modules/seasons/internal/types";


async function createOngoingSeason(overrides?: {
  status?: string;
  scraperUrl?: string | null;
  source?: string | null;
}) {
  const now = new Date();
  const seriesId = crypto.randomUUID();
  await db.insert(series).values({ id: seriesId, title: "Series", createdAt: now, updatedAt: now });
  const repository = createSeasonRepository(db);
  return repository.create({
    seriesId,
    title: "Season 1",
    seasonNumber: 1,
    status: overrides?.status ?? "ongoing",
    scraperUrl: overrides && "scraperUrl" in overrides ? overrides.scraperUrl : "https://example.com/scrape",
    source: overrides && "source" in overrides ? overrides.source : "example",
  });
}

describe("season service scrapeOngoingSeason", () => {
  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("throws SeasonNotFoundError for unknown season", async () => {
    const service = createSeasonService(db, { scrapeSeason: vi.fn() });
    await expect(service.scrapeOngoingSeason(crypto.randomUUID())).rejects.toBeInstanceOf(
      SeasonNotFoundError,
    );
  });

  it("throws SeasonNotOngoingError when season is not ongoing", async () => {
    const season = await createOngoingSeason({ status: "completed" });
    const service = createSeasonService(db, { scrapeSeason: vi.fn() });
    await expect(service.scrapeOngoingSeason(season.id)).rejects.toBeInstanceOf(
      SeasonNotOngoingError,
    );
  });

  it("throws SeasonMissingScraperUrlError when scraperUrl or source is missing", async () => {
    const season = await createOngoingSeason({ scraperUrl: null, source: null });
    const service = createSeasonService(db, { scrapeSeason: vi.fn() });
    await expect(service.scrapeOngoingSeason(season.id)).rejects.toBeInstanceOf(
      SeasonMissingScraperUrlError,
    );
  });

  it("delegates to the injected scrape function for a valid ongoing season", async () => {
    const season = await createOngoingSeason();
    const scrapeSeason = vi.fn<ScrapeSeasonDelegate>(async () => ({
      seasonId: season.id,
      seriesId: season.seriesId,
      success: true,
      episodesScraped: 2,
      sourcesSaved: 4,
      seasonCompleted: false,
    }));
    const service = createSeasonService(db, { scrapeSeason });

    const result = await service.scrapeOngoingSeason(season.id);

    expect(scrapeSeason).toHaveBeenCalledTimes(1);
    expect(scrapeSeason.mock.calls[0]?.[0]?.id).toBe(season.id);
    expect(result.success).toBe(true);
    expect(result.episodesScraped).toBe(2);
    expect(result.sourcesSaved).toBe(4);
  });
});
