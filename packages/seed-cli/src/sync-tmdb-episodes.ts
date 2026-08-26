import { randomUUID } from "node:crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { createDbClient, episodes, seasons, series, type DbClient } from "@repo/db";

export interface TmdbEpisodeApiItem {
  id?: number;
  episode_number: number;
  name?: string | null;
  overview?: string | null;
  runtime?: number | null;
  still_path?: string | null;
  vote_average?: number | null;
  air_date?: string | null;
  [key: string]: unknown;
}

export interface TmdbSeasonApiResponse {
  episodes?: TmdbEpisodeApiItem[];
  [key: string]: unknown;
}

export interface EpisodeUpsertItem {
  id: string;
  seasonId: string;
  order: number;
  title: string;
  description: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  rating: string | null;
  airDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncTmdbEpisodesDeps {
  findSeasons?: () => Promise<Array<{ id: string; tmdbId: number; tmdbSeason: number; title?: string | null }>>;
  upsertEpisodes?: (seasonId: string, items: EpisodeUpsertItem[]) => Promise<number>;
}

export interface SyncTmdbEpisodesOptions {
  db?: DbClient;
  fetchFn?: (url: string, init?: RequestInit) => Promise<any>;
  logFn?: (message: string) => void;
  sleepFn?: (ms: number) => Promise<void>;
  apiKey?: string;
  batchDelayMs?: number;
  deps?: SyncTmdbEpisodesDeps;
}

export async function syncTmdbEpisodes(options: SyncTmdbEpisodesOptions = {}): Promise<void> {
  const log = options.logFn ?? console.log;
  const sleepFn = options.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const batchDelayMs = options.batchDelayMs ?? (process.env.TMDB_SYNC_DELAY_MS ? parseInt(process.env.TMDB_SYNC_DELAY_MS, 10) : 100);

  const apiKey = options.apiKey ?? process.env.TMDB_API_KEY;
  if (!apiKey && !options.fetchFn) {
    throw new Error("Missing TMDB_API_KEY environment variable");
  }

  let db: DbClient | undefined;
  if (!options.deps?.findSeasons || !options.deps?.upsertEpisodes) {
    db = options.db ?? createDbClient();
  }

  const findSeasons = options.deps?.findSeasons ?? (async () => {
    const rows = await db!
      .select({
        id: seasons.id,
        tmdbId: series.tmdbId,
        tmdbSeason: seasons.tmdbSeason,
        title: seasons.title,
      })
      .from(seasons)
      .innerJoin(series, eq(seasons.seriesId, series.id))
      .where(and(isNotNull(series.tmdbId), isNotNull(seasons.tmdbSeason)));

    return rows.filter(
      (r): r is typeof r & { tmdbId: number; tmdbSeason: number } =>
        r.tmdbId !== null && r.tmdbSeason !== null
    );
  });

  const upsertEpisodes = options.deps?.upsertEpisodes ?? (async (_seasonId: string, items: EpisodeUpsertItem[]) => {
    if (items.length === 0) return 0;
    await db!
      .insert(episodes)
      .values(items)
      .onConflictDoUpdate({
        target: [episodes.seasonId, episodes.order],
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          duration: sql`excluded.duration`,
          thumbnailUrl: sql`excluded.thumbnail_url`,
          rating: sql`excluded.rating`,
          airDate: sql`excluded.air_date`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    return items.length;
  });

  const defaultFetchFn = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    if (!res.ok) {
      if (res.status === 429) {
        log("TMDB rate limit hit. Retrying in 2000ms...");
        await sleepFn(2000);
        return defaultFetchFn(url, init);
      }
      throw new Error(`TMDB API Error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  };

  const fetchFn = options.fetchFn ?? defaultFetchFn;

  log("Fetching seasons linked to TMDB from database...");
  const seasonsToSync = await findSeasons();

  const eligibleSeasons = seasonsToSync.filter(
    (s) => s.tmdbId != null && s.tmdbSeason != null
  );

  if (eligibleSeasons.length === 0) {
    log("No eligible seasons found with valid TMDB ID and TMDB Season.");
    return;
  }

  log(`Found ${eligibleSeasons.length} seasons with TMDB mappings to sync.`);

  let totalUpserted = 0;
  let succeededSeasons = 0;
  let failedSeasons = 0;
  const startTime = Date.now();

  for (let i = 0; i < eligibleSeasons.length; i++) {
    const season = eligibleSeasons[i];
    log(`[${i + 1}/${eligibleSeasons.length}] Processing season ${season.id} ("${season.title ?? "Untitled"}") - TMDB ID: ${season.tmdbId}, Season: ${season.tmdbSeason}`);

    try {
      const tmdbUrl = `https://api.themoviedb.org/3/tv/${season.tmdbId}/season/${season.tmdbSeason}`;
      const seasonData: TmdbSeasonApiResponse = await fetchFn(tmdbUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          accept: "application/json",
        },
      });

      const rawEpisodes = Array.isArray(seasonData.episodes) ? seasonData.episodes : [];
      const now = new Date();

      const transformedEpisodes: EpisodeUpsertItem[] = rawEpisodes.map((ep) => {
        let airDate: Date | null = null;
        if (ep.air_date) {
          const parsedDate = new Date(ep.air_date);
          if (!isNaN(parsedDate.getTime())) {
            airDate = parsedDate;
          }
        }

        return {
          id: randomUUID(),
          seasonId: season.id,
          order: ep.episode_number,
          title: ep.name && ep.name.trim() !== "" ? ep.name : `Episode ${ep.episode_number}`,
          description: ep.overview ?? null,
          duration: ep.runtime != null ? Number(ep.runtime) : null,
          thumbnailUrl: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
          rating: ep.vote_average != null ? String(ep.vote_average) : null,
          airDate,
          createdAt: now,
          updatedAt: now,
        };
      });

      const upsertedCount = await upsertEpisodes(season.id, transformedEpisodes);
      totalUpserted += upsertedCount;
      succeededSeasons++;

      log(`  -> Upserted ${upsertedCount} episodes for season ${season.id}.`);
    } catch (err) {
      failedSeasons++;
      log(
        `  -> Error processing season ${season.id}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    if (i < eligibleSeasons.length - 1 && batchDelayMs > 0) {
      await sleepFn(batchDelayMs);
    }
  }

  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  log("\n==================================================");
  log("TMDB EPISODE SYNC SUMMARY");
  log("==================================================");
  log(`Total Seasons Processed : ${eligibleSeasons.length}`);
  log(`Total Episodes Upserted  : ${totalUpserted}`);
  log(`Succeeded Seasons       : ${succeededSeasons}`);
  log(`Failed Seasons          : ${failedSeasons}`);
  log(`Duration                : ${durationSeconds} seconds`);
  log("==================================================\n");
}

if (import.meta.main) {
  syncTmdbEpisodes().catch((err) => {
    console.error("Fatal error during TMDB episode sync:", err);
    process.exit(1);
  });
}
