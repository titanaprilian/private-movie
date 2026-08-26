import { createDbClient } from "./client";
import { series, seasons, episodes, videoSources, seriesToGenres } from "./schema/media";
import { eq, inArray, ilike } from "drizzle-orm";
import * as fs from "fs";

const DB_URL = process.env.DATABASE_URL;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const db = createDbClient(DB_URL);

async function fetchTmdbDetails(tmdbId: number, seasonNumber: number) {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`;
  const res: any = await (await fetch(url, { headers: { Authorization: `Bearer ${TMDB_API_KEY}` } })).json();
  const season = res.seasons?.find((s: any) => s.season_number === seasonNumber) || res.seasons[0] || {};
  return {
    title: season.name || res.name,
    description: season.overview || res.overview || null,
    posterUrl: season.poster_path || res.poster_path || null,
    backdropUrl: res.backdrop_path || null,
  };
}

async function deleteSeries(seriesIds: string[]) {
  if (seriesIds.length === 0) return;
  const uniqueSeriesIds = [...new Set(seriesIds)];
  
  // Find all seasons
  const seasonRecords = await db.select({ id: seasons.id }).from(seasons).where(inArray(seasons.seriesId, uniqueSeriesIds));
  const seasonIds = seasonRecords.map(s => s.id);
  
  if (seasonIds.length > 0) {
    // Find all episodes
    const episodeRecords = await db.select({ id: episodes.id }).from(episodes).where(inArray(episodes.seasonId, seasonIds));
    const episodeIds = episodeRecords.map(e => e.id);
    
    if (episodeIds.length > 0) {
      // batch delete video sources
      await db.delete(videoSources).where(inArray(videoSources.episodeId, episodeIds));
      // batch delete episodes
      await db.delete(episodes).where(inArray(episodes.id, episodeIds));
    }
    
    // delete seasons
    await db.delete(seasons).where(inArray(seasons.id, seasonIds));
  }
  
  // delete seriesToGenres
  await db.delete(seriesToGenres).where(inArray(seriesToGenres.seriesId, uniqueSeriesIds));
  // delete series
  await db.delete(series).where(inArray(series.id, uniqueSeriesIds));
}

async function run() {
  console.log("Starting manual repair...");

  // 1. Railgun
  console.log("Repairing Railgun...");
  const railgunMeta = await fetchTmdbDetails(30977, 2);
  await db.update(seasons).set({
    tmdbSeason: 2,
    title: railgunMeta.title,
    description: railgunMeta.description,
    posterUrl: railgunMeta.posterUrl,
    tmdbSyncStatus: "SYNCED"
  }).where(eq(seasons.id, "e2633e97-6fcf-4cd5-9f95-55a720decb7b"));
  
  // 2. Honzoku (Bookworm)
  console.log("Repairing Bookworm...");
  // Merge 3 seasons
  const bookwormMain = "1a797257-58bd-4951-8838-cee58cc7aa36";
  const bookwormSubs = ["dade4fda-f4aa-485d-b9db-098354301594", "509f3d7c-4340-4b1b-be08-b7a6fc40d70c"];
  
  await db.update(episodes).set({ seasonId: bookwormMain }).where(inArray(episodes.seasonId, bookwormSubs));
  await db.delete(seasons).where(inArray(seasons.id, bookwormSubs));
  
  const bookwormMeta1 = await fetchTmdbDetails(90344, 1);
  await db.update(seasons).set({
    tmdbSeason: 1,
    title: bookwormMeta1.title,
    description: bookwormMeta1.description,
    posterUrl: bookwormMeta1.posterUrl,
    tmdbSyncStatus: "SYNCED"
  }).where(eq(seasons.id, bookwormMain));

  const bookwormMeta2 = await fetchTmdbDetails(90344, 2);
  await db.update(seasons).set({
    tmdbSeason: 2,
    title: bookwormMeta2.title,
    description: bookwormMeta2.description,
    posterUrl: bookwormMeta2.posterUrl,
    tmdbSyncStatus: "SYNCED"
  }).where(eq(seasons.id, "685a3d2d-0a53-4ce9-ad8b-4bdb57b5aa8a"));

  // 3. Mashle
  console.log("Repairing Mashle...");
  const mashleMain = "fb09722f-7ce5-429d-976e-5707adb323fd";
  const mashleSubs = ["1c551863-6482-44f7-b96e-7b9d0c3e5301"];
  
  await db.update(episodes).set({ seasonId: mashleMain }).where(inArray(episodes.seasonId, mashleSubs));
  await db.delete(seasons).where(inArray(seasons.id, mashleSubs));
  
  const mashleMeta = await fetchTmdbDetails(202998, 1);
  await db.update(seasons).set({
    tmdbSeason: 1,
    title: mashleMeta.title,
    description: mashleMeta.description,
    posterUrl: mashleMeta.posterUrl,
    tmdbSyncStatus: "SYNCED"
  }).where(eq(seasons.id, mashleMain));

  // 4. Bakemonogatari / Monogatari
  console.log("Deleting Monogatari/Bakemonogatari...");
  const monoSeries = await db.select({ id: series.id }).from(series).where(ilike(series.title, '%monogatari%'));
  if (monoSeries.length > 0) {
    await deleteSeries(monoSeries.map(s => s.id));
  }
  
  // 5. Cells at Work
  console.log("Deleting Cells at work...");
  const cellsSeason1 = await db.select({ seriesId: seasons.seriesId }).from(seasons).where(eq(seasons.id, "c89bff4d-615c-4f6e-aa9a-75f5d3c9c0c1"));
  const cellsSeason2 = await db.select({ seriesId: seasons.seriesId }).from(seasons).where(eq(seasons.id, "dec0efae-50d3-487c-85e1-ffb5c836bdb0"));
  const cellsIds = [...cellsSeason1.map(s => s.seriesId), ...cellsSeason2.map(s => s.seriesId)];
  if(cellsIds.length > 0) await deleteSeries(cellsIds);

  console.log("Now handling the rest of the unhandled duplicates (deleting them)...");
  
  const duplicates = JSON.parse(fs.readFileSync("../../duplicate_seasons.json", "utf8"));
  let handledTitles = ["A Certain Scientific Railgun", "Adopted Daughter of an Archduke", "Bakemonogatari", "Buryonka from Maslenkino", "Cells at Work!! The Return of the Strongest Enemy: A Huge Uproar in the Body’s Bowels!"];
  
  const seriesToDelete = [];
  
  for (const group of duplicates) {
    let handled = false;
    for (const ht of handledTitles) {
      if (group.title.includes(ht)) {
        handled = true;
        break;
      }
    }
    // "Monogatari" specifically
    if (group.title.includes("Monogatari") || group.title.includes("monogatari")) handled = true; // wait we handled it
    
    if (!handled) {
      // Find series IDs for this group
      const sIds = await db.select({ seriesId: seasons.seriesId }).from(seasons).where(inArray(seasons.id, group.duplicate_ids));
      seriesToDelete.push(...sIds.map(s => s.seriesId));
    }
  }
  
  if (seriesToDelete.length > 0) {
    console.log(`Deleting ${seriesToDelete.length} unhandled duplicate series...`);
    await deleteSeries(seriesToDelete);
  }

  console.log("Manual repair script finished successfully!");
  process.exit(0);
}

run().catch(console.error);
