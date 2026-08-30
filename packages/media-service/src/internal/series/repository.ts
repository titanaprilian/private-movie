import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { episodes, genres, seasons, series, seriesToGenres, videoSources, type EpisodeRow, type SeasonRow, type SeriesRow, type VideoSourceRow } from "@repo/db";
import type { EpisodeWithVideoSources } from "../episodes/repository";

export class SeriesNotFoundError extends Error {
  constructor(message = "Series not found") {
    super(message);
    this.name = "SeriesNotFoundError";
  }
}

export function compareSeasons<
  T extends { seasonNumber?: number | null; createdAt?: Date | string | null }
>(a: T, b: T): number {
  const getGroup = (season: T) => {
    const s = season.seasonNumber;
    if (s !== null && s !== undefined && s > 0) return 1;
    if (s === 0) return 2;
    return 3;
  };

  const groupA = getGroup(a);
  const groupB = getGroup(b);

  if (groupA !== groupB) {
    return groupA - groupB;
  }

  if (groupA === 1) {
    const tmdbA = a.seasonNumber!;
    const tmdbB = b.seasonNumber!;
    if (tmdbA !== tmdbB) {
      return tmdbA - tmdbB;
    }
  }

  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return timeA - timeB;
}

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

export interface SeriesUpsertInput {
  id?: string;
  sourceUrl?: string;
  source?: string;
  title: string;
  description?: string | null;
  type?: "tv" | "movie";
  posterUrl?: string | null;
  backdropUrl?: string | null;
  rating?: string | null;
  tmdbId?: number | null;
  tmdbSyncStatus?: "PENDING" | "SYNCED" | "FAILED";
}

export interface SeriesRelationItem {
  relatedSeriesId: string;
  relationType: string;
}

export interface UpdateSeriesInput {
  title?: string;
  description?: string | null;
  type?: "tv" | "movie";
  posterUrl?: string | null;
  backdropUrl?: string | null;
  rating?: string | null;
  tmdbId?: number | null;
  seasonNumber?: number | null;
  tmdbSyncStatus?: "PENDING" | "SYNCED" | "FAILED";
  isFeatured?: boolean;
  genreIds?: string[];
  relations?: SeriesRelationItem[];
}

export interface SeriesListParams {
  page: number;
  limit?: number;
  source?: string;
  q?: string;
  genre?: string;
}

export type SeasonWithEpisodes = SeasonRow & {
  episodes: EpisodeWithVideoSources[];
};

export type SeriesWithSeasons = SeriesRow & {
  seasons: SeasonRow[];
  genres?: Array<{ id: string; name: string; slug: string }>;
};

export interface SeriesListResult {
  series: SeriesWithSeasons[];
  total: number;
}

export type SeriesWithEpisodes = SeriesRow & {
  seasons: SeasonWithEpisodes[];
  episodes: EpisodeWithVideoSources[];
  relations: SeriesRelationItem[];
  genres?: Array<{ id: string; name: string; slug: string }>;
};

export interface SeriesWithMetadata extends SeriesRow {
  genres: Array<{ id: string; name: string; slug: string }>;
  seasonsCount: number;
  episodesCount: number;
}

export interface HomeFeedHero extends SeriesWithMetadata {
  tags: string[];
}

export interface HomeFeedRow {
  title: string;
  items: SeriesWithMetadata[];
}

export interface HomeFeedPayload {
  hero: HomeFeedHero | null;
  rows: HomeFeedRow[];
}

export function createSeriesRepositoryInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>) {
  return {
    async upsert(input: SeriesUpsertInput): Promise<SeriesRow> {
      const now = new Date();
      const id = input.id ?? randomUUID();
      const [row] = await db
        .insert(series)
        .values({
          id,
          title: input.title,
          description: input.description ?? null,
          type: input.type ?? "tv",
          posterUrl: input.posterUrl ?? null,
          backdropUrl: input.backdropUrl ?? null,
          rating: input.rating ?? null,
          tmdbId: input.tmdbId ?? null,
          tmdbSyncStatus: input.tmdbSyncStatus ?? "PENDING",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: series.id,
          set: {
            title: input.title,
            description: input.description ?? null,
            ...(input.type ? { type: input.type } : {}),
            ...(input.posterUrl !== undefined ? { posterUrl: input.posterUrl } : {}),
            ...(input.backdropUrl !== undefined ? { backdropUrl: input.backdropUrl } : {}),
            ...(input.rating !== undefined ? { rating: input.rating } : {}),
            ...(input.tmdbId !== undefined ? { tmdbId: input.tmdbId } : {}),
            ...(input.tmdbSyncStatus !== undefined ? { tmdbSyncStatus: input.tmdbSyncStatus } : {}),
            updatedAt: now,
          },
        })
        .returning();
      return row;
    },

    async findById(id: string): Promise<SeriesRow | null> {
      const [row] = await db
        .select()
        .from(series)
        .where(eq(series.id, id));
      return row ?? null;
    },

    async findByTmdbId(tmdbId: number): Promise<SeriesRow | null> {
      const [row] = await db
        .select()
        .from(series)
        .where(eq(series.tmdbId, tmdbId));
      return row ?? null;
    },

    async findByIdWithEpisodes(id: string): Promise<SeriesWithEpisodes | null> {
      const [seriesRow] = await db
        .select()
        .from(series)
        .where(eq(series.id, id));

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
          asc(seasons.createdAt)
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

        for (const s of sources) {
          const list = sourcesMap.get(s.episodeId) ?? [];
          list.push(s);
          sourcesMap.set(s.episodeId, list);
        }
      }

      const episodesWithSources = childEpisodes.map((ep) => ({
        ...ep,
        videoSources: sourcesMap.get(ep.id) ?? [],
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
        relations: [],
        genres: seriesGenres,
      };
    },

    async list(params: SeriesListParams): Promise<SeriesListResult> {
      const limit = Math.max(
        1,
        Math.min(params.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
      );
      const page = Math.max(1, params.page);
      const offset = (page - 1) * limit;

      const conditions = [];

      if (params.q && params.q.trim() !== "") {
        const pattern = `%${params.q.trim()}%`;
        conditions.push(
          or(
            ilike(series.title, pattern),
            ilike(series.description, pattern)
          )
        );
      }

      if (params.genre && params.genre.trim() !== "") {
        const matchingSeriesIds = db
          .select({ id: seriesToGenres.seriesId })
          .from(seriesToGenres)
          .innerJoin(genres, eq(seriesToGenres.genreId, genres.id))
          .where(eq(genres.slug, params.genre.trim()));

        conditions.push(inArray(series.id, matchingSeriesIds));
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
          .orderBy(desc(series.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ value: count() }).from(series).where(where),
      ]);

      const seriesIds = rows.map((s) => s.id);
      const seasonsMap = new Map<string, SeasonRow[]>();
      const genresMap = new Map<string, Array<{ id: string; name: string; slug: string }>>();

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
            asc(seasons.createdAt)
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
    },

    async updateSeries(
      id: string,
      input: UpdateSeriesInput
    ): Promise<SeriesWithSeasons & { relations: SeriesRelationItem[] }> {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.posterUrl !== undefined) updateData.posterUrl = input.posterUrl;
      if (input.backdropUrl !== undefined) updateData.backdropUrl = input.backdropUrl;
      if (input.rating !== undefined) updateData.rating = input.rating;
      if (input.tmdbId !== undefined) updateData.tmdbId = input.tmdbId;
      if (input.tmdbSyncStatus !== undefined) updateData.tmdbSyncStatus = input.tmdbSyncStatus;
      if (input.isFeatured !== undefined) updateData.isFeatured = input.isFeatured;

      const [row] = await db
        .update(series)
        .set(updateData)
        .where(eq(series.id, id))
        .returning();

      if (!row) {
        throw new SeriesNotFoundError(`Series with id ${id} not found`);
      }

      if (input.genreIds !== undefined) {
        await db
          .delete(seriesToGenres)
          .where(eq(seriesToGenres.seriesId, id));

        if (input.genreIds.length > 0) {
          await db
            .insert(seriesToGenres)
            .values(
              input.genreIds.map((genreId) => ({
                seriesId: id,
                genreId,
              }))
            );
        }
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
          asc(seasons.createdAt)
        );

      childSeasons.sort(compareSeasons);

      return {
        ...row,
        seasons: childSeasons,
        relations: [],
      };
    },

    async deleteSeries(id: string): Promise<SeriesRow> {
      const childSeasons = await db
        .select({ id: seasons.id })
        .from(seasons)
        .where(eq(seasons.seriesId, id));
      const seasonIds = childSeasons.map((s) => s.id);

      if (seasonIds.length > 0) {
        await db
          .delete(episodes)
          .where(inArray(episodes.seasonId, seasonIds));
      }

      const [row] = await db
        .delete(series)
        .where(eq(series.id, id))
        .returning();

      if (!row) {
        throw new SeriesNotFoundError(`Series with id ${id} not found`);
      }

      return row;
    },

    async getHomeFeed(): Promise<HomeFeedPayload> {
      const hasVideoSources = sql`EXISTS (
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

      const [heroSeries] = await db
        .select()
        .from(series)
        .where(and(eq(series.isFeatured, true), hasVideoSources))
        .orderBy(desc(series.updatedAt), desc(series.createdAt))
        .limit(1);

      const [ongoingRows, recentlyAddedRows] = await Promise.all([
        db
          .select()
          .from(series)
          .where(and(hasOngoingSeason, hasVideoSources))
          .orderBy(desc(series.updatedAt))
          .limit(10),
        db
          .select()
          .from(series)
          .where(hasVideoSources)
          .orderBy(desc(series.createdAt))
          .limit(10),
      ]);

      const allSeriesMap = new Map<string, SeriesRow>();
      if (heroSeries) {
        allSeriesMap.set(heroSeries.id, heroSeries);
      }
      for (const s of [...ongoingRows, ...recentlyAddedRows]) {
        allSeriesMap.set(s.id, s);
      }

      const allSeriesList = Array.from(allSeriesMap.values());
      const allSeriesIds = allSeriesList.map((s) => s.id);

      const genresMap = new Map<string, Array<{ id: string; name: string; slug: string }>>();
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

      let hero: HomeFeedHero | null = null;
      if (heroSeries) {
        const enrichedHero = enrichedMap.get(heroSeries.id)!;
        const genreNames = enrichedHero.genres.map((g) => g.name);
        const typeTag = enrichedHero.type === "movie" ? "Movie" : "TV Series";
        const tags = [typeTag, ...genreNames];
        hero = {
          ...enrichedHero,
          tags,
        };
      }

      const rows: HomeFeedRow[] = [
        {
          title: "Ongoing",
          items: ongoingRows.map((s) => enrichedMap.get(s.id)!),
        },
        {
          title: "Recently Added",
          items: recentlyAddedRows.map((s) => enrichedMap.get(s.id)!),
        },
      ];

      return {
        hero,
        rows,
      };
    },
  };
}
