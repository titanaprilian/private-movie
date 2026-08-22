import { eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { DbClient } from "./client";
import {
  genres,
  seasons,
  series,
  seriesToGenres,
  type NewGenreRow,
  type NewSeriesRow,
  type NewSeriesToGenreRow,
} from "./schema/media";
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

  logger(`\n=== ${isDryRun ? "DRY RUN SUMMARY" : "EXECUTION SUMMARY"} ===`);
  logger(`Distinct TMDB IDs processed: ${plans.length}`);
  logger(`Total seasons ${isDryRun ? "planned to relink" : "relinked"}: ${totalSeasonsRelinked}`);
  logger(`Total duplicate series ${isDryRun ? "planned to delete" : "deleted"}: ${totalDuplicatesDeleted}`);
  logger(`Total genres extracted: ${totalGenresExtracted}`);

  if (isDryRun) {
    logger("[DRY RUN GUARANTEE] No DML/DDL queries (TRUNCATE, UPDATE, DELETE) were executed.");
  } else {
    logger("\n[DB EXECUTION] Applying merge database mutations...");

    const runMutations = async (tx: any) => {
      logger("  - Truncating genres table...");
      await tx.execute(sql`TRUNCATE TABLE genres CASCADE`);

      const uniqueGenresMap = new Map<string, NewGenreRow>();
      const seriesToGenreRows: NewSeriesToGenreRow[] = [];

      for (const plan of plans) {
        await tx
          .update(series)
          .set({
            title: plan.seriesPatch.title,
            description: plan.seriesPatch.description,
            type: plan.seriesPatch.type,
            posterUrl: plan.seriesPatch.posterUrl,
            backdropUrl: plan.seriesPatch.backdropUrl,
            rating: plan.seriesPatch.rating,
            tmdbId: plan.seriesPatch.tmdbId,
            tmdbSyncStatus: plan.seriesPatch.tmdbSyncStatus,
            updatedAt: plan.seriesPatch.updatedAt,
          })
          .where(eq(series.id, plan.canonicalSeriesId));

        if (plan.seasonIdsToUpdate.length > 0) {
          await tx
            .update(seasons)
            .set({
              seriesId: plan.canonicalSeriesId,
              updatedAt: new Date(),
            })
            .where(inArray(seasons.id, plan.seasonIdsToUpdate));
        }

        for (const g of plan.extractedGenres) {
          if (!uniqueGenresMap.has(g.slug)) {
            uniqueGenresMap.set(g.slug, g);
          }
          const genreId = uniqueGenresMap.get(g.slug)!.id;
          seriesToGenreRows.push({
            seriesId: plan.canonicalSeriesId,
            genreId,
          });
        }
      }

      const allUniqueGenres = Array.from(uniqueGenresMap.values());
      if (allUniqueGenres.length > 0) {
        logger(`  - Inserting ${allUniqueGenres.length} unique genres...`);
        await tx
          .insert(genres)
          .values(allUniqueGenres)
          .onConflictDoNothing({ target: genres.slug });
      }

      if (seriesToGenreRows.length > 0) {
        const deduplicatedMappings = Array.from(
          new Map(seriesToGenreRows.map((m) => [`${m.seriesId}:${m.genreId}`, m])).values()
        );
        logger(`  - Inserting ${deduplicatedMappings.length} series-to-genre mappings...`);
        await tx
          .insert(seriesToGenres)
          .values(deduplicatedMappings)
          .onConflictDoNothing();
      }

      const allDuplicateSeriesIds = Array.from(
        new Set(plans.flatMap((plan) => plan.duplicateSeriesIds))
      );
      if (allDuplicateSeriesIds.length > 0) {
        logger(`  - Deleting ${allDuplicateSeriesIds.length} duplicate series rows...`);
        await tx
          .delete(series)
          .where(inArray(series.id, allDuplicateSeriesIds));
      }
    };

    if (typeof options.db.transaction === "function") {
      await options.db.transaction(runMutations);
    } else {
      await runMutations(options.db);
    }

    logger("[DB EXECUTION] All database mutations completed successfully.");
  }

  return {
    processedTmdbIds: plans.length,
    totalSeasonsRelinked,
    totalDuplicatesDeleted,
    totalGenresExtracted,
    dryRun: isDryRun,
    plans,
  };
}
