import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { type DbClient, series, seasons, episodes, createDbClient } from "@repo/db";

export interface TmdbSeriesSeasonMeta {
  id: number;
  season_number: number;
  name: string;
  overview?: string | null;
  poster_path?: string | null;
  air_date?: string | null;
  episode_count?: number;
}

export interface TmdbSeriesDetailsResponse {
  id: number;
  name: string;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string | null;
  vote_average?: number | null;
  status?: string | null;
  genres?: Array<{ id: number; name: string }>;
  seasons?: TmdbSeriesSeasonMeta[];
  [key: string]: unknown;
}

export interface TmdbEpisodeDetails {
  id: number;
  episode_number: number;
  name?: string | null;
  overview?: string | null;
  runtime?: number | null;
  still_path?: string | null;
  vote_average?: number | null;
  air_date?: string | null;
  [key: string]: unknown;
}

export interface TmdbSeasonDetailsResponse {
  id: number;
  season_number: number;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  air_date?: string | null;
  episodes?: TmdbEpisodeDetails[];
  [key: string]: unknown;
}

export interface TmdbSeasonFullData {
  seasonNumber: number;
  name: string;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  episodes: TmdbEpisodeDetails[];
}

export interface TmdbSeriesFullData {
  tmdbId: number;
  title: string;
  description: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  firstAirDate: string | null;
  voteAverage: number | null;
  genres: string[];
  seasons: TmdbSeasonFullData[];
}

export interface SeedTmdbOptions {
  idsFilePath?: string;
  tmdbIds?: number[];
  token?: string;
  fetchFn?: (url: string, init?: RequestInit) => Promise<any>;
  logFn?: (message: string) => void;
  sleepFn?: (ms: number) => Promise<void>;
  batchDelayMs?: number;
  includeSpecials?: boolean;
  onSeriesFetched?: (data: TmdbSeriesFullData) => Promise<void>;
}

export interface SeedTmdbPipelineResult {
  totalIds: number;
  processedSeriesCount: number;
  failedSeriesCount: number;
  totalSeasonsFetched: number;
  series: TmdbSeriesFullData[];
}

export const DEFAULT_TMDB_IDS_PATH =
  process.env.TMDB_IDS_FILE_PATH ||
  (fs.existsSync(path.resolve(process.cwd(), "tmdb-ids.txt"))
    ? path.resolve(process.cwd(), "tmdb-ids.txt")
    : path.resolve(process.cwd(), "packages/seed-cli/tmdb-ids.txt"));

export function parseTmdbIdsContent(content: string): number[] {
  const lines = content.split(/\r?\n/);
  const ids: number[] = [];

  for (const rawLine of lines) {
    // Strip comments starting with #
    const commentIdx = rawLine.indexOf("#");
    const lineWithoutComment = commentIdx !== -1 ? rawLine.slice(0, commentIdx) : rawLine;
    const trimmed = lineWithoutComment.trim();

    if (!trimmed) continue;

    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed) && parsed > 0) {
      ids.push(parsed);
    }
  }

  return ids;
}

export function parseTmdbIdsFile(filePath: string): number[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`TMDB IDs file not found at ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return parseTmdbIdsContent(content);
}

export async function fetchTmdbSeriesData(
  tmdbId: number,
  options: {
    token?: string;
    fetchFn?: (url: string, init?: RequestInit) => Promise<any>;
    logFn?: (message: string) => void;
    sleepFn?: (ms: number) => Promise<void>;
    includeSpecials?: boolean;
  } = {}
): Promise<TmdbSeriesFullData> {
  const log = options.logFn ?? console.log;
  const sleepFn = options.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const token = options.token ?? process.env.TMDB_TOKEN ?? process.env.TMDB_API_KEY;

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
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const seriesUrl = `https://api.themoviedb.org/3/tv/${tmdbId}`;
  const seriesData: TmdbSeriesDetailsResponse = await fetchFn(seriesUrl, { headers });

  const includeSpecials = options.includeSpecials ?? false;
  const rawSeasons = Array.isArray(seriesData.seasons) ? seriesData.seasons : [];
  const targetSeasons = rawSeasons.filter((s) => (includeSpecials ? s.season_number >= 0 : s.season_number > 0));

  const seasonsFullData: TmdbSeasonFullData[] = [];

  for (const sMeta of targetSeasons) {
    const seasonUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${sMeta.season_number}`;
    const seasonData: TmdbSeasonDetailsResponse = await fetchFn(seasonUrl, { headers });

    seasonsFullData.push({
      seasonNumber: sMeta.season_number,
      name: seasonData.name ?? sMeta.name ?? `Season ${sMeta.season_number}`,
      overview: seasonData.overview ?? sMeta.overview ?? null,
      posterPath: seasonData.poster_path
        ? `https://image.tmdb.org/t/p/w500${seasonData.poster_path}`
        : sMeta.poster_path
        ? `https://image.tmdb.org/t/p/w500${sMeta.poster_path}`
        : null,
      airDate: seasonData.air_date ?? sMeta.air_date ?? null,
      episodes: Array.isArray(seasonData.episodes) ? seasonData.episodes : [],
    });
  }

  return {
    tmdbId: seriesData.id ?? tmdbId,
    title: seriesData.name,
    description: seriesData.overview ?? null,
    posterPath: seriesData.poster_path ? `https://image.tmdb.org/t/p/w500${seriesData.poster_path}` : null,
    backdropPath: seriesData.backdrop_path ? `https://image.tmdb.org/t/p/w500${seriesData.backdrop_path}` : null,
    firstAirDate: seriesData.first_air_date ?? null,
    voteAverage: seriesData.vote_average ?? null,
    genres: (seriesData.genres || []).map((g) => g.name),
    seasons: seasonsFullData,
  };
}

export async function saveTmdbSeries(
  db: DbClient,
  data: TmdbSeriesFullData
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Upsert Series
    const [seriesRow] = await tx
      .insert(series)
      .values({
        id: crypto.randomUUID(),
        title: data.title,
        description: data.description,
        posterUrl: data.posterPath,
        backdropUrl: data.backdropPath,
        rating: data.voteAverage ? String(data.voteAverage) : null,
        tmdbId: data.tmdbId,
        type: "tv",
        createdAt: new Date(),
        updatedAt: new Date(),
        tmdbSyncStatus: "SYNCED",
      })
      .onConflictDoUpdate({
        target: series.tmdbId,
        set: {
          title: data.title,
          description: data.description,
          posterUrl: data.posterPath,
          backdropUrl: data.backdropPath,
          rating: data.voteAverage ? String(data.voteAverage) : null,
          updatedAt: new Date(),
          tmdbSyncStatus: "SYNCED",
        },
      })
      .returning({ id: series.id });

    // 2. Upsert Seasons and Episodes
    for (const season of data.seasons) {
      const [seasonRow] = await tx
        .insert(seasons)
        .values({
          id: crypto.randomUUID(),
          seriesId: seriesRow.id,
          seasonNumber: season.seasonNumber,
          title: season.name,
          description: season.overview,
          posterUrl: season.posterPath,
          createdAt: new Date(),
          updatedAt: new Date(),
          tmdbSyncStatus: "SYNCED",
        })
        .onConflictDoUpdate({
          target: [seasons.seriesId, seasons.seasonNumber],
          set: {
            title: season.name,
            description: season.overview,
            posterUrl: season.posterPath,
            updatedAt: new Date(),
            tmdbSyncStatus: "SYNCED",
          },
        })
        .returning({ id: seasons.id });

      for (const episode of season.episodes) {
        const thumbnailUrl = episode.still_path
          ? `https://image.tmdb.org/t/p/w500${episode.still_path}`
          : null;

        await tx
          .insert(episodes)
          .values({
            id: crypto.randomUUID(),
            seasonId: seasonRow.id,
            order: episode.episode_number,
            title: episode.name || `Episode ${episode.episode_number}`,
            description: episode.overview,
            thumbnailUrl,
            rating: episode.vote_average ? String(episode.vote_average) : null,
            airDate: episode.air_date ? new Date(episode.air_date) : null,
            duration: episode.runtime || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [episodes.seasonId, episodes.order],
            set: {
              title: episode.name || `Episode ${episode.episode_number}`,
              description: episode.overview,
              thumbnailUrl,
              rating: episode.vote_average ? String(episode.vote_average) : null,
              airDate: episode.air_date ? new Date(episode.air_date) : null,
              duration: episode.runtime || null,
              updatedAt: new Date(),
            },
          });
      }
    }
  });
}

export async function seedTmdb(options: SeedTmdbOptions = {}): Promise<SeedTmdbPipelineResult> {
  const log = options.logFn ?? console.log;
  const sleepFn = options.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const batchDelayMs =
    options.batchDelayMs ??
    (process.env.TMDB_SEED_DELAY_MS ? parseInt(process.env.TMDB_SEED_DELAY_MS, 10) : 100);

  const token = options.token ?? process.env.TMDB_TOKEN ?? process.env.TMDB_API_KEY;
  if (!token && !options.fetchFn) {
    throw new Error("Missing TMDB_TOKEN environment variable");
  }

  let tmdbIds: number[];
  if (options.tmdbIds) {
    tmdbIds = options.tmdbIds;
  } else {
    const idsPath = options.idsFilePath ?? DEFAULT_TMDB_IDS_PATH;
    log(`Reading TMDB IDs from file: ${idsPath}...`);
    tmdbIds = parseTmdbIdsFile(idsPath);
  }

  log(`Found ${tmdbIds.length} TMDB ID(s) to process.`);

  const fetchedSeries: TmdbSeriesFullData[] = [];
  let processedSeriesCount = 0;
  let failedSeriesCount = 0;
  let totalSeasonsFetched = 0;
  const startTime = Date.now();

  for (let i = 0; i < tmdbIds.length; i++) {
    const tmdbId = tmdbIds[i];
    log(`[${i + 1}/${tmdbIds.length}] Fetching metadata for TMDB ID: ${tmdbId}...`);

    try {
      const seriesFull = await fetchTmdbSeriesData(tmdbId, {
        token,
        fetchFn: options.fetchFn,
        logFn: log,
        sleepFn,
        includeSpecials: options.includeSpecials,
      });

      fetchedSeries.push(seriesFull);
      processedSeriesCount++;
      totalSeasonsFetched += seriesFull.seasons.length;

      log(`  -> Successfully fetched "${seriesFull.title}" with ${seriesFull.seasons.length} season(s).`);

      if (options.onSeriesFetched) {
        await options.onSeriesFetched(seriesFull);
      }
    } catch (err) {
      failedSeriesCount++;
      log(
        `  -> Error processing TMDB ID ${tmdbId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    if (i < tmdbIds.length - 1 && batchDelayMs > 0) {
      await sleepFn(batchDelayMs);
    }
  }

  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  log("\n==================================================");
  log("TMDB SEED PIPELINE SUMMARY");
  log("==================================================");
  log(`Total TMDB IDs      : ${tmdbIds.length}`);
  log(`Processed Series    : ${processedSeriesCount}`);
  log(`Failed Series       : ${failedSeriesCount}`);
  log(`Total Seasons Fetch : ${totalSeasonsFetched}`);
  log(`Duration            : ${durationSeconds} seconds`);
  log("==================================================\n");

  return {
    totalIds: tmdbIds.length,
    processedSeriesCount,
    failedSeriesCount,
    totalSeasonsFetched,
    series: fetchedSeries,
  };
}

if (import.meta.main) {
  const db = createDbClient();
  seedTmdb({
    onSeriesFetched: async (data: TmdbSeriesFullData) => {
      await saveTmdbSeries(db, data);
    },
  }).catch((err) => {
    console.error("Fatal error during TMDB seed pipeline:", err);
    process.exit(1);
  });
}
