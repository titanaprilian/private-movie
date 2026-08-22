import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { episodes, genres, seasons, series, seriesToGenres, videoSources, type EpisodeRow, type SeasonRow, type SeriesRow, type VideoSourceRow } from "@repo/db";
import type { EpisodeWithVideoSources } from "../episodes/repository";

export class SeriesNotFoundError extends Error {
  constructor(message = "Series not found") {
    super(message);
    this.name = "SeriesNotFoundError";
  }
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
  tmdbSeason?: number | null;
  tmdbSyncStatus?: "PENDING" | "SYNCED" | "FAILED";
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

export interface SeriesListResult {
  series: SeriesRow[];
  total: number;
}

export type SeriesWithEpisodes = SeriesRow & {
  episodes: EpisodeWithVideoSources[];
  relations: SeriesRelationItem[];
};

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

    async findBySourceUrl(sourceUrl: string): Promise<SeriesRow | null> {
      const [seasonRow] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.sourceUrl, sourceUrl));
      if (!seasonRow) return null;
      return this.findById(seasonRow.seriesId);
    },

    async findById(id: string): Promise<SeriesRow | null> {
      const [row] = await db
        .select()
        .from(series)
        .where(eq(series.id, id));
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
        .where(eq(seasons.seriesId, id));

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

      return {
        ...seriesRow,
        episodes: episodesWithSources,
        relations: [],
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

      if (params.source) {
        const matchingSeriesIds = db
          .select({ id: seasons.seriesId })
          .from(seasons)
          .where(eq(seasons.source, params.source));
        conditions.push(inArray(series.id, matchingSeriesIds));
      }

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

      return {
        series: rows,
        total: totalRows[0]?.value ?? 0,
      };
    },

    async updateSeries(
      id: string,
      input: UpdateSeriesInput
    ): Promise<SeriesRow & { relations: SeriesRelationItem[] }> {
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

      return {
        ...row,
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
          .update(episodes)
          .set({ seasonId: null })
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
  };
}
