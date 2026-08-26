import { eq } from "drizzle-orm";
import { createDbClient } from "./client";
import { series, seasons } from "./schema/media";
import { parseLocalTitle } from "./tmdb/parser";
import { findBestMatch, findMatchingSeason } from "./tmdb/matcher";
import type { 
  TmdbTvSearchResult, 
  TmdbTvDetails, 
  TmdbMovieSearchResult,
  TmdbMovieDetails 
} from "./tmdb/types";

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
  console.log("Fetching PENDING seasons from database...");
  const records = await db
    .select()
    .from(seasons)
    .where(eq(seasons.tmdbSyncStatus, "PENDING"));

  console.log(`Found ${records.length} series to sync.`);

  let succeeded = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const parsed = parseLocalTitle(record.title);
      console.log(`\nProcessing [${record.id}] "${record.title}"`);
      console.log(`Parsed: Base="${parsed.baseTitle}", Season=${parsed.seasonNumber}`, parsed.year ? `Year=${parsed.year}` : "");

      // 1. Try TV Endpoint
      const tvSearchData = await fetchFromTmdb<{ results: TmdbTvSearchResult[] }>(
        `/search/tv?query=${encodeURIComponent(parsed.baseTitle)}&language=en-US`
      );

      let tvMatch = findBestMatch(parsed.baseTitle, tvSearchData.results, { year: parsed.year });

      if (!tvMatch) {
        if (tvSearchData.results.length === 1) {
          tvMatch = { result: tvSearchData.results[0], score: 0.5 };
        } else if (tvSearchData.results.length > 1) {
          const animResults = tvSearchData.results.filter(r => r.genre_ids?.includes(16));
          if (animResults.length === 1) {
            console.log(`⚠️ Text match failed, but found exactly 1 animated result. Forcing match.`);
            tvMatch = { result: animResults[0], score: 0.5 };
          }
        }
      }

      if (tvMatch) {
        console.log(`✅ Matched with TMDB TV ID: ${tvMatch.result.id} ("${tvMatch.result.name}")`);
        
        const details = await fetchFromTmdb<TmdbTvDetails>(`/tv/${tvMatch.result.id}?language=en-US`);
        let season = findMatchingSeason(details, parsed.seasonNumber);

        if (!season) {
          console.log(`⚠️ Missing season ${parsed.seasonNumber} on TMDB. Falling back to Season 1 (or first available).`);
          season = details.seasons?.find(s => s.season_number === 1) || details.seasons?.[0] || null;
        }

        if (!season) {
          console.log(`❌ Found TV Show, but missing seasons entirely on TMDB. Moving to FAILED.`);
          await db.update(seasons).set({ tmdbSyncStatus: "FAILED" }).where(eq(seasons.id, record.id));
          failed++;
        } else {
          // Construct update payload
          const updatedTitle = details.name; 
          const updatedDescription = season.overview || details.overview || record.description;
          const updatedPoster = season.poster_path || details.poster_path || record.posterUrl;
          const backdrop = details.backdrop_path;
          const ratingStr = details.vote_average ? String(details.vote_average) : undefined;

          await db.update(seasons).set({
            tmdbSeason: season.season_number,
            title: updatedTitle,
            description: updatedDescription,
            posterUrl: updatedPoster,
            tmdbSyncStatus: "SYNCED"
          }).where(eq(seasons.id, record.id));

          console.log(`🌟 SUCCESSFULLY synced TV data for season ${season.season_number}!`);
          succeeded++;
        }
      } else {
        // 2. Fallback to Movie Endpoint if TV failed
        console.log(`⚠️ TV Match failed. Attempting Movie search...`);
        const movieSearchData = await fetchFromTmdb<{ results: TmdbMovieSearchResult[] }>(
          `/search/movie?query=${encodeURIComponent(parsed.baseTitle)}&language=en-US`
        );

        let movieMatch = findBestMatch(parsed.baseTitle, movieSearchData.results, { year: parsed.year });

        if (!movieMatch) {
          if (movieSearchData.results.length === 1) {
            movieMatch = { result: movieSearchData.results[0], score: 0.5 };
          } else if (movieSearchData.results.length > 1) {
            const animResults = movieSearchData.results.filter(r => r.genre_ids?.includes(16));
            if (animResults.length === 1) {
              console.log(`⚠️ Text match failed, but found exactly 1 animated result. Forcing match.`);
              movieMatch = { result: animResults[0], score: 0.5 };
            }
          }
        }

        if (movieMatch) {
          console.log(`✅ Matched with TMDB MOVIE ID: ${movieMatch.result.id} ("${movieMatch.result.title}")`);
          
          const details = await fetchFromTmdb<TmdbMovieDetails>(`/movie/${movieMatch.result.id}?language=en-US`);

          // Movies don't have seasons, so we just set tmdbSeason to 1 and map the movie
          const updatedTitle = details.title; 
          const updatedDescription = details.overview || record.description;
          const updatedPoster = details.poster_path || record.posterUrl;
          const backdrop = details.backdrop_path;
          const ratingStr = details.vote_average ? String(details.vote_average) : undefined;

          await db.update(seasons).set({
            tmdbSeason: 1,
            title: updatedTitle,
            description: updatedDescription,
            posterUrl: updatedPoster,
            tmdbSyncStatus: "SYNCED"
          }).where(eq(seasons.id, record.id));

          console.log(`🌟 SUCCESSFULLY synced MOVIE data!`);
          succeeded++;
        } else {
          console.log(`❌ No confident match in TV nor MOVIE endpoints. Moving to FAILED.`);
          await db.update(seasons).set({ tmdbSyncStatus: "FAILED" }).where(eq(seasons.id, record.id));
          failed++;
        }
      }
    } catch (error) {
      console.error(`💥 Error processing record ${record.id}:`, error);
      console.log("Flagging as FAILED.");
      await db.update(seasons).set({ tmdbSyncStatus: "FAILED" }).where(eq(seasons.id, record.id));
      failed++;
    }

    // Sleep to respect TMDB API limits
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n--- Sync Complete ---`);
  console.log(`Total Succeeded: ${succeeded}`);
  console.log(`Total Failed: ${failed}`);

  process.exit(0);
}

runTmdbSync().catch(console.error);
