import fs from "node:fs";
import path from "node:path";
import { createDbClient, type DbClient } from "@repo/db";
import {
  MediaScraper,
  type FetchFn as ScraperFetchFn,
} from "@repo/media-scraper";
import {
  createMediaService,
  createSeriesRepositoryInternal,
  defaultFetchFn,
  type FetchFn,
  type MediaService,
  type SaveMediaInput,
  type SaveMediaSeriesInput,
} from "@repo/media-service";

export * from "./sync-tmdb-episodes";
export * from "./seed-tmdb";
export * from "./scrape-otakudesu";

export interface SeriesListItem {
  title?: string;
  fullTitle?: string;
  url?: string;
  sourceUrl?: string;
  link?: string;
}

export interface SeedDeps {
  seriesRepository?: {
    findBySourceUrl(sourceUrl: string): Promise<{ id: string; title: string } | null>;
  };
  mediaService?: {
    saveMedia(input: SaveMediaInput): Promise<unknown>;
  };
}

export interface SeedOptions {
  jsonPath?: string;
  db?: DbClient;
  fetchFn?: FetchFn;
  logFn?: (message: string) => void;
  batchSize?: number;
  batchDelayMs?: number;
  maxItems?: number;
  offset?: number;
  sleepFn?: (ms: number) => Promise<void>;
  deps?: SeedDeps;
}

export const DEFAULT_JSON_PATH =
  process.env.SEED_FILE_PATH ||
  path.resolve(
    process.cwd(),
    "packages/media-scraper/test/fixtures/full/sample-full-list.json"
  );

export async function runSeed(options: SeedOptions = {}): Promise<void> {
  const log = options.logFn ?? console.log;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;

  const defaultBatchSize = process.env.SEED_BATCH_SIZE
    ? parseInt(process.env.SEED_BATCH_SIZE, 10)
    : 20;
  const defaultBatchDelayMs = process.env.SEED_BATCH_DELAY_MS
    ? parseInt(process.env.SEED_BATCH_DELAY_MS, 10)
    : 2000;

  const defaultMaxItems = process.env.SEED_MAX_ITEMS
    ? parseInt(process.env.SEED_MAX_ITEMS, 10)
    : undefined;
  const defaultOffset = process.env.SEED_OFFSET
    ? parseInt(process.env.SEED_OFFSET, 10)
    : undefined;

  const batchSize = options.batchSize ?? defaultBatchSize;
  const batchDelayMs = options.batchDelayMs ?? defaultBatchDelayMs;
  const maxItems = options.maxItems ?? defaultMaxItems;
  const offset = options.offset ?? defaultOffset;
  const sleepFn =
    options.sleepFn ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  log(`Loading series list from ${jsonPath}...`);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Seed JSON file not found at ${jsonPath}`);
  }

  const rawData = fs.readFileSync(jsonPath, "utf-8");
  let seriesList: SeriesListItem[] = JSON.parse(rawData);

  const startIdx = offset && offset > 0 ? offset : 0;
  const endIdx = maxItems !== undefined && maxItems > 0 ? startIdx + maxItems : undefined;

  if (startIdx > 0 || endIdx !== undefined) {
    seriesList = seriesList.slice(startIdx, endIdx);
  }

  log(`Found ${seriesList.length} series to process.`);
  log(`Batch configuration: process ${batchSize} series, delay ${batchDelayMs}ms between batches.`);

  let db: DbClient | undefined;
  if (!options.deps?.seriesRepository || !options.deps?.mediaService) {
    db = options.db ?? createDbClient();
  }

  const seriesRepository =
    options.deps?.seriesRepository ?? createSeriesRepositoryInternal(db!);
  const mediaService: MediaService =
    (options.deps?.mediaService as MediaService) ?? createMediaService(db!);
  const fetchFn = options.fetchFn ?? defaultFetchFn;

  const scraperFetchFn: ScraperFetchFn = {
    get: (url: string) => fetchFn.get(url),
    post: (url: string, body: string) => fetchFn.post(url, body),
  };

  const seenUrls = new Set<string>();
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let episodesInsertedCount = 0;
  let episodesFailedCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < seriesList.length; i++) {
    const item = seriesList[i];
    const sourceUrl = item.sourceUrl || item.url || item.link;

    if (!sourceUrl) {
      log(`[${i + 1}/${seriesList.length}] Skipping invalid entry with no URL.`);
      skippedCount++;
    } else if (seenUrls.has(sourceUrl)) {
      log(`[${i + 1}/${seriesList.length}] Series URL already processed in this run. Skipping: ${sourceUrl}`);
      skippedCount++;
    } else {
      seenUrls.add(sourceUrl);
      log(`[${i + 1}/${seriesList.length}] Processing series ${i + 1} of ${seriesList.length}: ${sourceUrl}`);

      try {
        const existing = await (seriesRepository as any).findBySourceUrl?.(sourceUrl);
        if (existing) {
          log(`[${i + 1}/${seriesList.length}] Series already exists in DB (${existing.title}). Skipping.`);
          skippedCount++;
        } else {
          const provider = MediaScraper.getProviderForUrl(sourceUrl);
          if (!provider) {
            log(`[${i + 1}/${seriesList.length}] No provider found for ${sourceUrl}. Skipping.`);
            skippedCount++;
          } else {
            const scrapedSeries = await provider.parseSeries(sourceUrl, scraperFetchFn);
            log(`[${i + 1}/${seriesList.length}] Parsed series "${scrapedSeries.title}" with ${scrapedSeries.episodes.length} episodes.`);

            const seriesInput: SaveMediaSeriesInput = {
              sourceUrl,
              source: "otakudesu",
              title: scrapedSeries.title,
              description: scrapedSeries.description ?? null,
              posterUrl: scrapedSeries.posterUrl ?? null,
            };

            for (let j = 0; j < scrapedSeries.episodes.length; j++) {
              const epRef = scrapedSeries.episodes[j];
              try {
                const scrapedEpisode = await provider.parseEpisode(epRef.url, scraperFetchFn);

                let videoSources = scrapedEpisode.videoSources;
                if (typeof provider.resolveVideoSources === "function") {
                  try {
                    videoSources = await provider.resolveVideoSources(epRef.url, scraperFetchFn, {
                      mirrorPayloads: scrapedEpisode.providerData?.mirrorPayloads,
                      ajaxActions: scrapedEpisode.providerData?.ajaxActions,
                      initialSources: scrapedEpisode.videoSources,
                    });
                  } catch (resErr) {
                    log(
                      `  Warning resolving video sources for ${epRef.url}: ${
                        resErr instanceof Error ? resErr.message : String(resErr)
                      }`
                    );
                  }
                }

                const saveInput: SaveMediaInput = {
                  series: seriesInput,
                  episode: {
                    sourceUrl: epRef.url,
                    source: "otakudesu",
                    title: scrapedEpisode.title,
                    videoType: scrapedEpisode.videoType ?? null,
                    videoSources: videoSources.map((vs) => ({
                      type: vs.type,
                      url: vs.url,
                      label: vs.label,
                      quality: vs.quality ?? null,
                    })),
                    metadata: {
                      ...(scrapedEpisode.genres ? { genres: scrapedEpisode.genres } : {}),
                      ...(scrapedEpisode.duration ? { duration: scrapedEpisode.duration } : {}),
                      ...(scrapedEpisode.posterUrl ? { posterUrl: scrapedEpisode.posterUrl } : {}),
                      ...(scrapedEpisode.downloadLinks ? { downloadLinks: scrapedEpisode.downloadLinks } : {}),
                    },
                  },
                };

                await mediaService.saveMedia(saveInput);
                episodesInsertedCount++;
                log(`  Saved episode [${j + 1}/${scrapedSeries.episodes.length}]: ${scrapedEpisode.title}`);
              } catch (epError) {
                episodesFailedCount++;
                log(
                  `  Error processing episode ${epRef.url}: ${
                    epError instanceof Error ? epError.message : String(epError)
                  }`
                );
              }
            }

            processedCount++;
          }
        }
      } catch (seriesError) {
        errorCount++;
        log(
          `[${i + 1}/${seriesList.length}] Error processing series ${sourceUrl}: ${
            seriesError instanceof Error ? seriesError.message : String(seriesError)
          }`
        );
      }
    }

    const isBatchEnd = (i + 1) % batchSize === 0;
    const isLastItem = i === seriesList.length - 1;
    if (isBatchEnd && !isLastItem && batchDelayMs > 0) {
      log(`--- Batch complete (${i + 1}/${seriesList.length}). Waiting ${batchDelayMs}ms... ---`);
      await sleepFn(batchDelayMs);
    }
  }

  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`\n==================================================`);
  log(`SEEDING SUMMARY`);
  log(`==================================================`);
  log(`Total Series in File : ${seriesList.length}`);
  log(`Processed Series     : ${processedCount}`);
  log(`Skipped Series       : ${skippedCount}`);
  log(`Failed Series        : ${errorCount}`);
  log(`Episodes Inserted    : ${episodesInsertedCount}`);
  log(`Episodes Failed      : ${episodesFailedCount}`);
  log(`Duration             : ${durationSeconds} seconds`);
  log(`==================================================\n`);
  log(`Seeding completed. Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
}

if (import.meta.main) {
  runSeed().catch((err) => {
    console.error("Fatal error during seeding:", err);
    process.exit(1);
  });
}
