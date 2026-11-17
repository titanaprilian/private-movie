import type { DbClient, SeasonRow } from "@repo/db";
import type { SeasonsRepository } from "@repo/media-service";

export type SeasonDb = SeasonRow;
export type SeasonRepository = SeasonsRepository;

export type {
  CreateSeasonInput,
  SeasonUpsertInput,
  UpdateSeasonInput,
} from "@repo/media-service";

export interface ScrapeOngoingSeasonResult {
  seasonId: string;
  seriesId: string;
  success: boolean;
  episodesScraped: number;
  sourcesSaved: number;
  seasonCompleted: boolean;
  error?: string | null;
}

export type ScrapeSeasonDelegate = (
  season: SeasonDb,
) => Promise<ScrapeOngoingSeasonResult>;

export interface SeasonServiceDeps {
  seasonsRepository?: SeasonRepository;
  scrapeSeason?: ScrapeSeasonDelegate;
}

export interface SeasonService {
  scrapeOngoingSeason(seasonId: string): Promise<ScrapeOngoingSeasonResult>;
}

export type SeasonDbClient = DbClient;
