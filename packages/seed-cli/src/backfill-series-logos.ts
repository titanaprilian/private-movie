import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { createDbClient, series, type DbClient } from "@repo/db";
import { selectBestTmdbLogo, type TmdbImagesResponse } from "@repo/media-service";

export interface SeriesLogoTarget {
  id: string;
  title: string;
  tmdbId: number;
  type: string;
  logoUrl: string | null;
}

export interface BackfillSeriesLogosDeps {
  findSeriesWithoutLogo?: () => Promise<SeriesLogoTarget[]>;
  updateSeriesLogo?: (seriesId: string, logoUrl: string) => Promise<unknown>;
}

export interface BackfillSeriesLogosOptions {
  db?: DbClient;
  fetchFn?: (url: string, init?: RequestInit) => Promise<any>;
  logFn?: (message: string) => void;
  sleepFn?: (ms: number) => Promise<void>;
  apiKey?: string;
  batchDelayMs?: number;
  deps?: BackfillSeriesLogosDeps;
}

export interface BackfillSeriesLogosSummary {
  totalSeries: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
}

export async function backfillSeriesLogos(
  options: BackfillSeriesLogosOptions = {}
): Promise<BackfillSeriesLogosSummary> {
  const log = options.logFn ?? console.log;
  const sleepFn = options.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const batchDelayMs = options.batchDelayMs ?? (process.env.TMDB_SYNC_DELAY_MS ? parseInt(process.env.TMDB_SYNC_DELAY_MS, 10) : 100);

  const apiKey = options.apiKey ?? process.env.TMDB_API_KEY ?? process.env.TMDB_TOKEN;
  if (!apiKey && !options.fetchFn) {
    throw new Error("Missing TMDB_API_KEY environment variable");
  }

  let db: DbClient | undefined;
  if (!options.deps?.findSeriesWithoutLogo || !options.deps?.updateSeriesLogo) {
    db = options.db ?? createDbClient();
  }

  const findSeriesWithoutLogo = options.deps?.findSeriesWithoutLogo ?? (async () => {
    const rows = await db!
      .select({
        id: series.id,
        title: series.title,
        tmdbId: series.tmdbId,
        type: series.type,
        logoUrl: series.logoUrl,
      })
      .from(series)
      .where(and(isNotNull(series.tmdbId), isNull(series.logoUrl)));

    return rows.filter(
      (r): r is SeriesLogoTarget => r.tmdbId !== null
    );
  });

  const updateSeriesLogo = options.deps?.updateSeriesLogo ?? (async (seriesId: string, logoUrl: string) => {
    await db!
      .update(series)
      .set({
        logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(series.id, seriesId));
  });

  const rawFetchFn = options.fetchFn ?? ((url: string, init?: RequestInit) => fetch(url, init));

  const fetchFnWithRetry = async (url: string, init?: RequestInit, retryCount = 0): Promise<any> => {
    const res = await rawFetchFn(url, init);

    if (res && typeof res === "object" && "status" in res && res.status === 429) {
      if (retryCount >= 5) {
        throw new Error(`TMDB rate limit exceeded after 5 retries: ${url}`);
      }
      const retryAfter = res.headers
        ? typeof res.headers.get === "function"
          ? res.headers.get("retry-after")
          : res.headers["retry-after"]
        : null;
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
      log(`TMDB rate limit hit (429). Retrying in ${waitMs}ms...`);
      await sleepFn(waitMs);
      return fetchFnWithRetry(url, init, retryCount + 1);
    }

    if (res && typeof res === "object" && "json" in res && typeof res.json === "function") {
      if ("ok" in res && !res.ok) {
        throw new Error(`TMDB API Error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    }

    return res;
  };

  log("Finding series with TMDB ID and missing logo in database...");
  const targetSeries = await findSeriesWithoutLogo();

  if (targetSeries.length === 0) {
    log("No series found requiring logo backfill.");
    return {
      totalSeries: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    };
  }

  log(`Found ${targetSeries.length} series to backfill logos.`);

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < targetSeries.length; i++) {
    const item = targetSeries[i];
    const isMovie = item.type === "movie";
    const endpointPrefix = isMovie ? "movie" : "tv";
    log(`[${i + 1}/${targetSeries.length}] Fetching logo for "${item.title}" (${endpointPrefix.toUpperCase()} ID: ${item.tmdbId})...`);

    try {
      const tmdbUrl = `https://api.themoviedb.org/3/${endpointPrefix}/${item.tmdbId}/images?include_image_language=en-US,en,null`;
      const headers: Record<string, string> = { accept: "application/json" };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const imagesData: TmdbImagesResponse = await fetchFnWithRetry(tmdbUrl, { headers });
      const bestLogoUrl = selectBestTmdbLogo(imagesData?.logos);

      if (bestLogoUrl) {
        await updateSeriesLogo(item.id, bestLogoUrl);
        updatedCount++;
        log(`  -> Saved logo: ${bestLogoUrl}`);
      } else {
        skippedCount++;
        log(`  -> No suitable logo found on TMDB.`);
      }
    } catch (err) {
      failedCount++;
      log(
        `  -> Error fetching/saving logo for series ${item.id}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    if (i < targetSeries.length - 1 && batchDelayMs > 0) {
      await sleepFn(batchDelayMs);
    }
  }

  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  log("\n==================================================");
  log("TMDB SERIES LOGO BACKFILL SUMMARY");
  log("==================================================");
  log(`Total Series Processed : ${targetSeries.length}`);
  log(`Logos Updated          : ${updatedCount}`);
  log(`No Logo Available      : ${skippedCount}`);
  log(`Failed Series          : ${failedCount}`);
  log(`Duration               : ${durationSeconds} seconds`);
  log("==================================================\n");

  return {
    totalSeries: targetSeries.length,
    updatedCount,
    skippedCount,
    failedCount,
  };
}

if (import.meta.main) {
  backfillSeriesLogos().catch((err) => {
    console.error("Fatal error during TMDB logo backfill:", err);
    process.exit(1);
  });
}
