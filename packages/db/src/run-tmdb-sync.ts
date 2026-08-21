import { eq } from "drizzle-orm";
import { createDbClient } from "./client";
import { series } from "./schema/media";
import { parseLocalTitle } from "./tmdb/parser";
import { findBestMatch, findMatchingSeason } from "./tmdb/matcher";
import type { TmdbTvSearchResult, TmdbTvDetails } from "./tmdb/types";

const DB_URL = process.env.DATABASE_URL;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.error("Missing TMDB_API_KEY environment variable.");
  process.exit(1);
}

const db = createDbClient(DB_URL);

async function fetchFromTmdb<T>(endpoint: string): Promise<T> {
  const url = `https://api.themoviedb.org/3${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_API_KEY}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.warn("TMDB Rate limit exceeded. Waiting 5000ms...");
      await new Promise((r) => setTimeout(r, 5000));
      return fetchFromTmdb<T>(endpoint);
    }
    throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function runTmdbSync() {
  console.log("Fetching PENDING series from database...");
  const records = await db
    .select()
    .from(series)
    .where(eq(series.tmdbSyncStatus, "PENDING"));

  console.log(`Found ${records.length} series to sync.`);

  let succeeded = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const parsed = parseLocalTitle(record.title);
      console.log(`\nProcessing [${record.id}] "${record.title}"`);
      console.log(`Parsed: Base="${parsed.baseTitle}", Season=${parsed.seasonNumber}`, parsed.year ? `Year=${parsed.year}` : "");

      const searchData = await fetchFromTmdb<{ results: TmdbTvSearchResult[] }>(
        `/search/tv?query=${encodeURIComponent(parsed.baseTitle)}&language=en-US`
      );

      let match = findBestMatch(parsed.baseTitle, searchData.results, { year: parsed.year });

      // Hybrid Fallback Rule: If confident match fails, but it's the exact ONLY result returned by TMDB
      if (!match && searchData.results.length === 1) {
        console.log(`⚠️ Low string confidence, but exactly 1 result found. Using Hybrid Single-Result Fallback!`);
        match = { result: searchData.results[0], score: 0.5 };
      }

      if (!match) {
        console.log(`❌ No confident match found in ${searchData.results.length} results. Moving to FAILED.`);
        await db.update(series).set({ tmdbSyncStatus: "FAILED" }).where(eq(series.id, record.id));
        failed++;
      } else {
        console.log(`✅ Matched with TMDB TV ID: ${match.result.id} ("${match.result.name}")`);
        
        const details = await fetchFromTmdb<TmdbTvDetails>(`/tv/${match.result.id}?language=en-US`);
        const season = findMatchingSeason(details, parsed.seasonNumber);

        if (!season) {
          console.log(`❌ Found TV Show, but missing season ${parsed.seasonNumber}. Moving to FAILED.`);
          await db.update(series).set({ tmdbSyncStatus: "FAILED" }).where(eq(series.id, record.id));
          failed++;
        } else {
          // Construct update payload
          const updatedTitle = details.name; // Based on spec override
          const updatedDescription = season.overview || details.overview || record.description;
          const updatedPoster = season.poster_path || details.poster_path || record.posterUrl;
          const backdrop = details.backdrop_path;
          const ratingStr = details.vote_average ? String(details.vote_average) : undefined;

          await db.update(series).set({
            tmdbId: details.id,
            tmdbSeason: season.season_number,
            title: updatedTitle,
            description: updatedDescription,
            posterUrl: updatedPoster,
            backdropUrl: backdrop,
            rating: ratingStr,
            tmdbSyncStatus: "SYNCED"
          }).where(eq(series.id, record.id));

          console.log(`🌟 SUCCESSFULLY synced data for season ${season.season_number}!`);
          succeeded++;
        }
      }
    } catch (error) {
      console.error(`💥 Error processing record ${record.id}:`, error);
      console.log("Flagging as FAILED.");
      await db.update(series).set({ tmdbSyncStatus: "FAILED" }).where(eq(series.id, record.id));
      failed++;
    }

    // Sleep to respect TMDB API limits (50 resp/sec allowed, 100ms is very safe)
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n--- Sync Complete ---`);
  console.log(`Total Succeeded: ${succeeded}`);
  console.log(`Total Failed: ${failed}`);

  process.exit(0);
}

runTmdbSync().catch(console.error);
