import type { DbClient } from "@repo/db";
import {
  SeasonMissingScraperUrlError,
  SeasonNotFoundError,
  SeasonNotOngoingError,
} from "./errors";
import { createSeasonRepository } from "./repository";
import type {
  ScrapeOngoingSeasonResult,
  SeasonService,
  SeasonServiceDeps,
} from "./types";

export function createSeasonService(db: DbClient, deps?: SeasonServiceDeps): SeasonService {
  const seasonsRepository = deps?.seasonsRepository ?? createSeasonRepository(db);
  const scrapeSeason = deps?.scrapeSeason;

  return {
    async scrapeOngoingSeason(seasonId: string): Promise<ScrapeOngoingSeasonResult> {
      const season = await seasonsRepository.findById(seasonId);
      if (!season) {
        throw new SeasonNotFoundError(`Season with id ${seasonId} not found`);
      }

      if (season.status !== "ongoing") {
        throw new SeasonNotOngoingError(
          `Season ${seasonId} is not in ongoing status (current status: ${season.status})`,
        );
      }

      if (!season.scraperUrl || !season.source) {
        throw new SeasonMissingScraperUrlError(
          `Season ${seasonId} is missing scraperUrl or source`,
        );
      }

      if (!scrapeSeason) {
        throw new Error(
          `No scrape delegate configured for season ${seasonId}`,
        );
      }

      return scrapeSeason(season);
    },
  };
}
