import type { DbClient, SeasonRow } from "@repo/db";

export type SeasonDb = SeasonRow;

export interface SeasonUpsertInput {
  seriesId: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  seasonNumber?: number | null;
  status?: "ongoing" | "completed" | "pending" | string;
  scraperUrl?: string | null;
  source?: string | null;
  episodeOffset?: number;
  lastScrapedAt?: Date | null;
  lastScrapeError?: string | null;
  tmdbSyncStatus?: "PENDING" | "SYNCED" | "FAILED";
}

export interface CreateSeasonInput {
  seriesId: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  seasonNumber?: number | null;
  status?: "ongoing" | "completed" | "pending" | string;
  scraperUrl?: string | null;
  source?: string | null;
  episodeOffset?: number;
}

export interface UpdateSeasonInput {
  title?: string;
  description?: string | null;
  posterUrl?: string | null;
  seasonNumber?: number | null;
  status?: "ongoing" | "completed" | "pending" | string;
  scraperUrl?: string | null;
  source?: string | null;
  episodeOffset?: number;
  lastScrapedAt?: Date | null;
  lastScrapeError?: string | null;
  tmdbSyncStatus?: "PENDING" | "SYNCED" | "FAILED";
}

export interface SeasonRepository {
  upsert(input: SeasonUpsertInput): Promise<SeasonDb>;
  findBySeriesIdAndSeasonNumber(seriesId: string, seasonNumber: number): Promise<SeasonDb | null>;
  findById(id: string): Promise<SeasonDb | null>;
  updateSeason(id: string, input: UpdateSeasonInput): Promise<SeasonDb>;
  reparentSeasons(fromSeriesId: string, toSeriesId: string): Promise<void>;
  deleteSeason(id: string): Promise<void>;
  findOngoingWithScraperUrl(): Promise<SeasonDb[]>;
  create(input: CreateSeasonInput): Promise<SeasonDb>;
}

export interface ScrapeOngoingSeasonResult {
  seasonId: string;
  seriesId: string;
  success: boolean;
  episodesScraped: number;
  sourcesSaved: number;
  seasonCompleted: boolean;
  error?: string | null;
}

/**
 * Injected scrape delegate. The domain service validates season state and
 * then hands the validated season to this delegate, which performs the
 * actual provider scrape (wired by the composition root / http adapter).
 * Kept injectable so the domain layer never imports `@repo/media-service`.
 */
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
