import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  episodes,
  genres,
  seasons,
  series,
  seriesToGenres,
  videoSources,
  type SeriesRow,
  type VideoSourceRow,
} from "@repo/db";
import {
  normalizeVideoSources,
  sortVideoSources,
} from "../playback/normalization";
import type {
  HomeFeedHero,
  HomeFeedPayload,
  HomeFeedRow,
  RecentlyAddedEpisode,
  SeriesRepositoryOptions,
  SeriesWithMetadata,
} from "./types";

const ONGOING_SOFT_CAP = 10;
const ONGOING_HARD_CAP = 20;

export async function fetchRecentlyAddedEpisodes<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  options?: SeriesRepositoryOptions,
): Promise<RecentlyAddedEpisode[]> {
  const candidateRows = await db
    .select({
      episode: episodes,
      season: seasons,
      serie: series,
      latestSourceAt: sql<Date>`MAX(${videoSources.createdAt})`,
    })
    .from(episodes)
    .innerJoin(videoSources, eq(videoSources.episodeId, episodes.id))
    .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
    .innerJoin(series, eq(seasons.seriesId, series.id))
    .groupBy(episodes.id, seasons.id, series.id)
    .orderBy(sql`MAX(${videoSources.createdAt}) DESC`);

  const seenSeries = new Set<string>();
  const picked: typeof candidateRows = [];
  for (const row of candidateRows) {
    if (seenSeries.has(row.serie.id)) continue;
    seenSeries.add(row.serie.id);
    picked.push(row);
    if (picked.length >= 10) break;
  }

  if (picked.length === 0) return [];

  const pickedEpisodeIds = picked.map((r) => r.episode.id);
  const allSources = await db
    .select()
    .from(videoSources)
    .where(inArray(videoSources.episodeId, pickedEpisodeIds))
    .orderBy(asc(videoSources.createdAt));

  const normalizedSources = await normalizeVideoSources(allSources, {
    s3StorageService: options?.s3StorageService,
    storageProviderRegistry: options?.storageProviderRegistry,
  });

  const sourcesByEpisode = new Map<string, VideoSourceRow[]>();
  for (const s of normalizedSources) {
    const list = sourcesByEpisode.get(s.episodeId) ?? [];
    list.push(s);
    sourcesByEpisode.set(s.episodeId, list);
  }

  return picked.map((row) => ({
    id: row.episode.id,
    title: row.episode.title,
    order: row.episode.order,
    thumbnailUrl: row.episode.thumbnailUrl,
    duration: row.episode.duration,
    rating: row.episode.rating,
    createdAt:
      row.episode.createdAt instanceof Date
        ? row.episode.createdAt.toISOString()
        : String(row.episode.createdAt),
    series: {
      id: row.serie.id,
      title: row.serie.title,
      posterUrl: row.serie.posterUrl,
      backdropUrl: row.serie.backdropUrl,
    },
    season: {
      id: row.season.id,
      seasonNumber: row.season.seasonNumber,
      title: row.season.title,
    },
    videoSources: sortVideoSources(sourcesByEpisode.get(row.episode.id) ?? []),
  }));
}

export async function fetchOngoingRow<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  extraConditions: ReturnType<typeof and>,
): Promise<SeriesRow[]> {
  const highlighted = await db
    .select()
    .from(series)
    .where(and(extraConditions, eq(series.isOngoingHighlighted, true)))
    .orderBy(desc(series.updatedAt))
    .limit(ONGOING_HARD_CAP);
  if (highlighted.length >= ONGOING_SOFT_CAP) {
    return highlighted.slice(0, ONGOING_HARD_CAP);
  }
  const backfill = await db
    .select()
    .from(series)
    .where(and(extraConditions, eq(series.isOngoingHighlighted, false)))
    .orderBy(desc(series.updatedAt))
    .limit(ONGOING_SOFT_CAP - highlighted.length);
  return [...highlighted, ...backfill];
}

export async function getHomeFeed<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  sourceTypes?: string[],
  options?: SeriesRepositoryOptions,
): Promise<HomeFeedPayload> {
  const normalizedTypes = (sourceTypes ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const hasTypeFilter = normalizedTypes.length > 0;
  const typeList = hasTypeFilter
    ? sql.join(
        normalizedTypes.map((t) => sql`${t}`),
        sql`, `,
      )
    : null;
  const hasVideoSources = hasTypeFilter
    ? sql`EXISTS (
    SELECT 1
    FROM ${videoSources}
    INNER JOIN ${episodes} ON ${videoSources.episodeId} = ${episodes.id}
    INNER JOIN ${seasons} ON ${episodes.seasonId} = ${seasons.id}
    WHERE ${seasons.seriesId} = ${series.id}
    AND ${videoSources.type} IN (${typeList})
  )`
    : sql`EXISTS (
    SELECT 1
    FROM ${videoSources}
    INNER JOIN ${episodes} ON ${videoSources.episodeId} = ${episodes.id}
    INNER JOIN ${seasons} ON ${episodes.seasonId} = ${seasons.id}
    WHERE ${seasons.seriesId} = ${series.id}
  )`;

  const hasOngoingSeason = sql`EXISTS (
    SELECT 1
    FROM ${seasons}
    WHERE ${seasons.seriesId} = ${series.id} AND ${seasons.status} = 'ongoing'
  )`;

  const activeBigGenres = await db
    .select()
    .from(genres)
    .where(eq(genres.isBigGenre, true))
    .orderBy(asc(genres.displayOrder), asc(genres.name));

  let heroSeriesList = await db
    .select()
    .from(series)
    .where(and(eq(series.isFeatured, true), hasVideoSources))
    .orderBy(desc(series.updatedAt), desc(series.createdAt))
    .limit(10);

  if (heroSeriesList.length === 0) {
    heroSeriesList = await db
      .select()
      .from(series)
      .where(hasVideoSources)
      .orderBy(desc(series.updatedAt), desc(series.createdAt))
      .limit(10);
  }

  const ongoingPerGenrePromises = activeBigGenres.map((bigGenre) => {
    const hasGenre = sql`EXISTS (
      SELECT 1
      FROM ${seriesToGenres}
      WHERE ${seriesToGenres.seriesId} = ${series.id} AND ${seriesToGenres.genreId} = ${bigGenre.id}
    )`;
    return fetchOngoingRow(
      db,
      and(hasOngoingSeason, hasGenre, hasVideoSources),
    );
  });

  const bigGenreRowsPromises = activeBigGenres.map((bigGenre) => {
    const hasGenre = sql`EXISTS (
      SELECT 1
      FROM ${seriesToGenres}
      WHERE ${seriesToGenres.seriesId} = ${series.id} AND ${seriesToGenres.genreId} = ${bigGenre.id}
    )`;
    return db
      .select()
      .from(series)
      .where(and(hasGenre, hasVideoSources))
      .orderBy(desc(series.createdAt))
      .limit(10);
  });

  const [ongoingPerGenreList, bigGenreRowsList] = await Promise.all([
    Promise.all(ongoingPerGenrePromises),
    Promise.all(bigGenreRowsPromises),
  ]);

  let fallbackOngoingRows: SeriesRow[] = [];
  const hasAnyPerGenreOngoing = ongoingPerGenreList.some(
    (rows) => rows.length > 0,
  );
  if (!hasAnyPerGenreOngoing) {
    fallbackOngoingRows = await fetchOngoingRow(
      db,
      and(hasOngoingSeason, hasVideoSources),
    );
  }

  const allSeriesMap = new Map<string, SeriesRow>();
  for (const s of [
    ...heroSeriesList,
    ...fallbackOngoingRows,
    ...ongoingPerGenreList.flat(),
    ...bigGenreRowsList.flat(),
  ]) {
    allSeriesMap.set(s.id, s);
  }

  const allSeriesList = Array.from(allSeriesMap.values());
  const allSeriesIds = allSeriesList.map((s) => s.id);

  const genresMap = new Map<
    string,
    Array<{ id: string; name: string; slug: string }>
  >();
  const seasonsCountMap = new Map<string, number>();
  const episodesCountMap = new Map<string, number>();

  if (allSeriesIds.length > 0) {
    const genreMappings = await db
      .select({
        seriesId: seriesToGenres.seriesId,
        id: genres.id,
        name: genres.name,
        slug: genres.slug,
      })
      .from(seriesToGenres)
      .innerJoin(genres, eq(seriesToGenres.genreId, genres.id))
      .where(inArray(seriesToGenres.seriesId, allSeriesIds));

    for (const g of genreMappings) {
      const list = genresMap.get(g.seriesId) ?? [];
      list.push({ id: g.id, name: g.name, slug: g.slug });
      genresMap.set(g.seriesId, list);
    }

    const seasonCounts = await db
      .select({
        seriesId: seasons.seriesId,
        value: count(seasons.id),
      })
      .from(seasons)
      .where(inArray(seasons.seriesId, allSeriesIds))
      .groupBy(seasons.seriesId);

    for (const sc of seasonCounts) {
      seasonsCountMap.set(sc.seriesId, Number(sc.value));
    }

    const episodeCounts = await db
      .select({
        seriesId: seasons.seriesId,
        value: count(episodes.id),
      })
      .from(episodes)
      .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
      .where(inArray(seasons.seriesId, allSeriesIds))
      .groupBy(seasons.seriesId);

    for (const ec of episodeCounts) {
      episodesCountMap.set(ec.seriesId, Number(ec.value));
    }
  }

  const enrichedMap = new Map<string, SeriesWithMetadata>();
  for (const s of allSeriesList) {
    enrichedMap.set(s.id, {
      ...s,
      genres: genresMap.get(s.id) ?? [],
      seasonsCount: seasonsCountMap.get(s.id) ?? 0,
      episodesCount: episodesCountMap.get(s.id) ?? 0,
    });
  }

  const heroes: HomeFeedHero[] = heroSeriesList.map((s) => {
    const enrichedHero = enrichedMap.get(s.id)!;
    const genreNames = enrichedHero.genres.map((g) => g.name);
    const typeTag = enrichedHero.type === "movie" ? "Movie" : "TV Series";
    const tags = [typeTag, ...genreNames];
    return {
      ...enrichedHero,
      tags,
    };
  });

  const hero: HomeFeedHero | null = heroes[0] ?? null;

  const rows: HomeFeedRow[] = [
    ...activeBigGenres.map((bigGenre, index) => ({
      title: `Ongoing ${bigGenre.name}`,
      items: (ongoingPerGenreList[index] ?? []).map((s) =>
        enrichedMap.get(s.id)!,
      ),
    })),
    ...(hasAnyPerGenreOngoing
      ? []
      : [
          {
            title: "Ongoing",
            items: fallbackOngoingRows.map((s) => enrichedMap.get(s.id)!),
          },
        ]),
    ...activeBigGenres.map((bigGenre, index) => ({
      title: bigGenre.name,
      items: (bigGenreRowsList[index] ?? []).map((s) => enrichedMap.get(s.id)!),
    })),
  ].filter((row) => row.items.length > 0);

  const recentlyAddedEpisodes = await fetchRecentlyAddedEpisodes(db, options);

  return {
    hero,
    heroes,
    rows,
    recentlyAddedEpisodes,
  };
}
