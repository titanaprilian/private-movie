import fs from "node:fs";
import path from "node:path";
import { type DbClient, createDbClient } from "@repo/db";
import {
  fetchTmdbSeriesData,
  saveTmdbSeries,
  type TmdbEpisodeDetails,
  type TmdbSeasonDetailsResponse,
  type TmdbSeasonFullData,
  type TmdbSeasonResponse,
  type TmdbSeriesDetailsResponse,
  type TmdbSeriesFullData,
  type TmdbSeriesSeasonMeta,
} from "@repo/media-service";

export type {
  TmdbEpisodeDetails,
  TmdbSeasonDetailsResponse,
  TmdbSeasonFullData,
  TmdbSeasonResponse,
  TmdbSeriesDetailsResponse,
  TmdbSeriesFullData,
  TmdbSeriesSeasonMeta,
};

export { fetchTmdbSeriesData, saveTmdbSeries };

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

