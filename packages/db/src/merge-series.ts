import { isNotNull } from "drizzle-orm";
import type { DbClient } from "./client";
import { seasons, type NewGenreRow, type NewSeriesRow } from "./schema/media";
import { parseTmdbTvDetails } from "./tmdb/parser";
import type { TmdbTvDetails } from "./tmdb/types";

export interface SeasonInput {
  id: string;
  seriesId: string;
  tmdbId: number | null;
  title: string;
}

export interface SeasonGroup {
  tmdbId: number;
  canonicalSeriesId: string;
  duplicateSeriesIds: string[];
  seasonIds: string[];
  seasons: SeasonInput[];
}

export interface TmdbMergePlan {
  tmdbId: number;
  canonicalSeriesId: string;
  duplicateSeriesIds: string[];
  seasonIdsToUpdate: string[];
  seriesPatch: NewSeriesRow;
  extractedGenres: NewGenreRow[];
}

export interface MergeSeriesOptions {
  db: DbClient | any;
  tmdbApiKey?: string;
  dryRun?: boolean;
  fetchTvDetails?: (tmdbId: number) => Promise<TmdbTvDetails>;
  delayMs?: number;
  logger?: (message: string) => void;
}

export interface MergeSeriesSummary {
  processedTmdbIds: number;
  totalSeasonsRelinked: number;
  totalDuplicatesDeleted: number;
  totalGenresExtracted: number;
  dryRun: boolean;
  plans: TmdbMergePlan[];
}

export function groupSeasonsByTmdbId(seasonsInput: SeasonInput[]): Map<number, SeasonGroup> {
  const groups = new Map<number, SeasonGroup>();

  for (const item of seasonsInput) {
    if (item.tmdbId === null || item.tmdbId === undefined) {
      continue;
    }

    const existing = groups.get(item.tmdbId);
    if (existing) {
      existing.seasons.push(item);
      existing.seasonIds.push(item.id);
      if (!existing.canonicalSeriesId && item.seriesId) {
        existing.canonicalSeriesId = item.seriesId;
      } else if (item.seriesId && item.seriesId !== existing.canonicalSeriesId) {
        if (!existing.duplicateSeriesIds.includes(item.seriesId)) {
          existing.duplicateSeriesIds.push(item.seriesId);
        }
      }
    } else {
      groups.set(item.tmdbId, {
        tmdbId: item.tmdbId,
        canonicalSeriesId: item.seriesId,
        duplicateSeriesIds: [],
        seasonIds: [item.id],
        seasons: [item],
      });
    }
  }

  return groups;
}

export function createMergePlanForTmdbId(
  details: TmdbTvDetails,
  group: SeasonGroup
): TmdbMergePlan {
  const parsed = parseTmdbTvDetails(details, { id: group.canonicalSeriesId });

  return {
    tmdbId: group.tmdbId,
    canonicalSeriesId: group.canonicalSeriesId,
    duplicateSeriesIds: group.duplicateSeriesIds,
    seasonIdsToUpdate: group.seasonIds,
    seriesPatch: parsed.series,
    extractedGenres: parsed.genres,
  };
}

async function defaultFetchTvDetails(tmdbId: number, apiKey?: string): Promise<TmdbTvDetails> {
  const key = apiKey || process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error("Missing TMDB_API_KEY environment variable.");
  }

  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.warn(`[TMDB Rate Limit 429] Waiting 5000ms before retrying TV ID ${tmdbId}...`);
      await new Promise((r) => setTimeout(r, 5000));
      return defaultFetchTvDetails(tmdbId, key);
    }
    throw new Error(`TMDB API Error fetching TV ID ${tmdbId}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<TmdbTvDetails>;
}

export async function mergeSeries(options: MergeSeriesOptions): Promise<MergeSeriesSummary> {
  const isDryRun = options.dryRun ?? true;
  const logger = options.logger ?? console.log;
  const delayMs = options.delayMs ?? 25; // 25ms delay enforces max 40 req/sec (safely under 50 req/sec limit)
  const fetcher = options.fetchTvDetails ?? ((id: number) => defaultFetchTvDetails(id, options.tmdbApiKey));

  logger(`[DRY RUN MODE: ${isDryRun}] Initializing Series deduplication dry-run...`);

  const fetchedSeasons: SeasonInput[] = await options.db
    .select({
      id: seasons.id,
      seriesId: seasons.seriesId,
      tmdbId: seasons.tmdbId,
      title: seasons.title,
    })
    .from(seasons)
    .where(isNotNull(seasons.tmdbId));

  const groups = groupSeasonsByTmdbId(fetchedSeasons);
  logger(`Found ${fetchedSeasons.length} seasons mapped to ${groups.size} unique TMDB IDs.`);

  const plans: TmdbMergePlan[] = [];
  let totalSeasonsRelinked = 0;
  let totalDuplicatesDeleted = 0;
  let totalGenresExtracted = 0;

  for (const [tmdbId, group] of groups.entries()) {
    try {
      const details = await fetcher(tmdbId);
      const plan = createMergePlanForTmdbId(details, group);
      plans.push(plan);

      totalSeasonsRelinked += plan.seasonIdsToUpdate.length;
      totalDuplicatesDeleted += plan.duplicateSeriesIds.length;
      totalGenresExtracted += plan.extractedGenres.length;

      logger(`\n[DRY RUN] TMDB ID ${tmdbId} ("${details.name}"):`);
      logger(`  - Canonical Series ID: ${plan.canonicalSeriesId}`);
      logger(
        `  - Metadata Patch: Title="${plan.seriesPatch.title}", Rating=${plan.seriesPatch.rating}, Poster=${plan.seriesPatch.posterUrl}`
      );
      logger(
        `  - Seasons to relink (${plan.seasonIdsToUpdate.length}): [${plan.seasonIdsToUpdate.join(", ")}] -> series_id = "${plan.canonicalSeriesId}"`
      );
      logger(
        `  - Duplicate Series to delete (${plan.duplicateSeriesIds.length}): [${plan.duplicateSeriesIds.join(", ")}]`
      );
      logger(
        `  - Extracted Genres (${plan.extractedGenres.length}): [${plan.extractedGenres.map((g) => g.name).join(", ")}]`
      );
    } catch (err: any) {
      logger(`⚠️ Failed to fetch or process TMDB ID ${tmdbId}: ${err.message || err}`);
    }

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  logger("\n=== DRY RUN SUMMARY ===");
  logger(`Distinct TMDB IDs processed: ${plans.length}`);
  logger(`Total seasons planned to relink: ${totalSeasonsRelinked}`);
  logger(`Total duplicate series planned to delete: ${totalDuplicatesDeleted}`);
  logger(`Total genres extracted: ${totalGenresExtracted}`);
  logger("[DRY RUN GUARANTEE] No DML/DDL queries (TRUNCATE, UPDATE, DELETE) were executed.");

  return {
    processedTmdbIds: plans.length,
    totalSeasonsRelinked,
    totalDuplicatesDeleted,
    totalGenresExtracted,
    dryRun: isDryRun,
    plans,
  };
}
