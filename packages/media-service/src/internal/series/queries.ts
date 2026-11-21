import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  episodes,
  genres,
  seasons,
  series,
  seriesToGenres,
  videoSources,
  type EpisodeRow,
  type SeasonRow,
  type SeriesRow,
  type VideoSourceRow,
} from "@repo/db";
import {
  normalizeVideoSources,
  sortVideoSources,
} from "../playback/normalization";
import type { EpisodeWithVideoSources } from "../episodes/repository";
import {
  compareSeasons,
  type SeasonWithEpisodes,
  type SeriesListParams,
  type SeriesListResult,
  type SeriesRepositoryOptions,
  type SeriesWithEpisodes,
  type SeriesWithSeasons,
} from "./types";

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

export async function findById<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>, id: string): Promise<SeriesRow | null> {
  const [row] = await db.select().from(series).where(eq(series.id, id));
  return row ?? null;
}

export async function findByTmdbId<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>, tmdbId: number): Promise<SeriesRow | null> {
  const [row] = await db.select().from(series).where(eq(series.tmdbId, tmdbId));
  return row ?? null;
}

export async function findByIdWithEpisodes<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  id: string,
  sourceTypes?: string[],
  options?: SeriesRepositoryOptions,
): Promise<SeriesWithEpisodes | null> {
  const [seriesRow] = await db.select().from(series).where(eq(series.id, id));

  if (!seriesRow) {
    return null;
  }

  const childSeasons = await db
    .select()
    .from(seasons)
    .where(eq(seasons.seriesId, id))
    .orderBy(
      sql`CASE 
        WHEN ${seasons.seasonNumber} IS NOT NULL AND ${seasons.seasonNumber} > 0 THEN 1 
        WHEN ${seasons.seasonNumber} = 0 THEN 2 
        ELSE 3 
      END ASC`,
      asc(seasons.seasonNumber),
      asc(seasons.createdAt),
    );

  childSeasons.sort(compareSeasons);

  const seasonIds = childSeasons.map((s) => s.id);
  let childEpisodes: EpisodeRow[] = [];

  if (seasonIds.length > 0) {
    childEpisodes = await db
      .select()
      .from(episodes)
      .where(inArray(episodes.seasonId, seasonIds))
      .orderBy(asc(episodes.order), asc(episodes.createdAt));
  }

  const episodeIds = childEpisodes.map((ep) => ep.id);
  const sourcesMap = new Map<string, VideoSourceRow[]>();

  if (episodeIds.length > 0) {
    const sources = await db
      .select()
      .from(videoSources)
      .where(inArray(videoSources.episodeId, episodeIds))
      .orderBy(asc(videoSources.createdAt));

    const normalizedSources = await normalizeVideoSources(sources, {
      s3StorageService: options?.s3StorageService,
      storageProviderRegistry: options?.storageProviderRegistry,
    });

    const filterSet =
      sourceTypes && sourceTypes.length > 0
        ? new Set(sourceTypes.map((t) => t.trim()).filter((t) => t.length > 0))
        : null;
    const hasFilter = filterSet !== null && filterSet.size > 0;

    for (const s of normalizedSources) {
      if (hasFilter && !filterSet!.has(s.type)) {
        continue;
      }
      const list = sourcesMap.get(s.episodeId) ?? [];
      list.push(s);
      sourcesMap.set(s.episodeId, list);
    }
  }

  const episodesWithSources = childEpisodes.map((ep) => ({
    ...ep,
    videoSources: sortVideoSources(sourcesMap.get(ep.id) ?? []),
  }));

  const episodesBySeasonMap = new Map<string, EpisodeWithVideoSources[]>();
  for (const ep of episodesWithSources) {
    if (ep.seasonId) {
      const list = episodesBySeasonMap.get(ep.seasonId) ?? [];
      list.push(ep);
      episodesBySeasonMap.set(ep.seasonId, list);
    }
  }

  const seasonsWithEpisodes: SeasonWithEpisodes[] = childSeasons.map((s) => ({
    ...s,
    episodes: episodesBySeasonMap.get(s.id) ?? [],
  }));

  const seriesGenres = await db
    .select({
      id: genres.id,
      name: genres.name,
      slug: genres.slug,
    })
    .from(seriesToGenres)
    .innerJoin(genres, eq(seriesToGenres.genreId, genres.id))
    .where(eq(seriesToGenres.seriesId, id))
    .orderBy(asc(genres.name));

  return {
    ...seriesRow,
    seasons: seasonsWithEpisodes,
    episodes: episodesWithSources,
    genres: seriesGenres,
  };
}

export async function list<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  params: SeriesListParams,
): Promise<SeriesListResult> {
  const limit = Math.max(
    1,
    Math.min(params.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT),
  );
  const page = Math.max(1, params.page);
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.q && params.q.trim() !== "") {
    const pattern = `%${params.q.trim()}%`;
    conditions.push(
      or(ilike(series.title, pattern), ilike(series.description, pattern)),
    );
  }

  if (params.filter === "featured") {
    conditions.push(eq(series.isFeatured, true));
  } else if (params.filter === "ongoing") {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(seasons)
          .where(
            and(eq(seasons.seriesId, series.id), eq(seasons.status, "ongoing")),
          ),
      ),
    );
  }

  if (params.highlighted === true) {
    conditions.push(eq(series.isOngoingHighlighted, true));
  }

  if (params.genre && params.genre.trim() !== "") {
    const slugs = params.genre
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (slugs.length > 0) {
      const matchingSeriesIds = db
        .select({ id: seriesToGenres.seriesId })
        .from(seriesToGenres)
        .innerJoin(genres, eq(seriesToGenres.genreId, genres.id))
        .where(inArray(genres.slug, slugs))
        .groupBy(seriesToGenres.seriesId)
        .having(sql`COUNT(DISTINCT ${genres.slug}) = ${slugs.length}`);

      conditions.push(inArray(series.id, matchingSeriesIds));
    }
  }

  const where =
    conditions.length > 0
      ? conditions.length === 1
        ? conditions[0]
        : and(...conditions)
      : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(series)
      .where(where)
      .orderBy(
        ...(params.filter === "ongoing"
          ? [desc(series.isOngoingHighlighted), desc(series.updatedAt)]
          : [desc(series.createdAt)]),
      )
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(series).where(where),
  ]);

  const seriesIds = rows.map((s) => s.id);
  const seasonsMap = new Map<string, SeasonRow[]>();
  const genresMap = new Map<
    string,
    Array<{ id: string; name: string; slug: string }>
  >();

  if (seriesIds.length > 0) {
    const childSeasons = await db
      .select()
      .from(seasons)
      .where(inArray(seasons.seriesId, seriesIds))
      .orderBy(
        sql`CASE 
          WHEN ${seasons.seasonNumber} IS NOT NULL AND ${seasons.seasonNumber} > 0 THEN 1 
          WHEN ${seasons.seasonNumber} = 0 THEN 2 
          ELSE 3 
        END ASC`,
        asc(seasons.seasonNumber),
        asc(seasons.createdAt),
      );

    childSeasons.sort(compareSeasons);

    for (const s of childSeasons) {
      const list = seasonsMap.get(s.seriesId) ?? [];
      list.push(s);
      seasonsMap.set(s.seriesId, list);
    }

    const allGenres = await db
      .select({
        seriesId: seriesToGenres.seriesId,
        id: genres.id,
        name: genres.name,
        slug: genres.slug,
      })
      .from(seriesToGenres)
      .innerJoin(genres, eq(seriesToGenres.genreId, genres.id))
      .where(inArray(seriesToGenres.seriesId, seriesIds))
      .orderBy(asc(genres.name));

    for (const g of allGenres) {
      const list = genresMap.get(g.seriesId) ?? [];
      list.push({ id: g.id, name: g.name, slug: g.slug });
      genresMap.set(g.seriesId, list);
    }
  }

  const seriesWithSeasons: SeriesWithSeasons[] = rows.map((s) => ({
    ...s,
    seasons: seasonsMap.get(s.id) ?? [],
    genres: genresMap.get(s.id) ?? [],
  }));

  return {
    series: seriesWithSeasons,
    total: totalRows[0]?.value ?? 0,
  };
}
