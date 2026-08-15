import { randomUUID } from "node:crypto";
import { count, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { episodes, series, type EpisodeRow, type SeriesRow } from "@repo/db";

export class SeriesNotFoundError extends Error {
  constructor(message = "Series not found") {
    super(message);
    this.name = "SeriesNotFoundError";
  }
}

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

export interface SeriesUpsertInput {
  sourceUrl: string;
  source: string;
  title: string;
  description: string | null;
  posterUrl: string | null;
}

export interface UpdateSeriesInput {
  title?: string;
  description?: string | null;
  posterUrl?: string | null;
}

export interface SeriesListParams {
  page: number;
  limit?: number;
  source?: string;
}

export interface SeriesListResult {
  series: SeriesRow[];
  total: number;
}

export type SeriesWithEpisodes = SeriesRow & { episodes: EpisodeRow[] };

export function createSeriesRepositoryInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>) {
  return {
    async upsert(input: SeriesUpsertInput): Promise<SeriesRow> {
      const now = new Date();
      const [row] = await db
        .insert(series)
        .values({
          id: randomUUID(),
          sourceUrl: input.sourceUrl,
          source: input.source,
          title: input.title,
          description: input.description,
          posterUrl: input.posterUrl,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: series.sourceUrl,
          set: {
            source: input.source,
            title: input.title,
            description: input.description,
            posterUrl: input.posterUrl,
            updatedAt: now,
          },
        })
        .returning();
      return row;
    },

    async findBySourceUrl(sourceUrl: string): Promise<SeriesRow | null> {
      const [row] = await db
        .select()
        .from(series)
        .where(eq(series.sourceUrl, sourceUrl));
      return row ?? null;
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

      const childEpisodes = await db
        .select()
        .from(episodes)
        .where(eq(episodes.seriesId, id))
        .orderBy(desc(episodes.createdAt));

      return {
        ...seriesRow,
        episodes: childEpisodes,
      };
    },

    async list(params: SeriesListParams): Promise<SeriesListResult> {
      const limit = Math.max(
        1,
        Math.min(params.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
      );
      const page = Math.max(1, params.page);
      const offset = (page - 1) * limit;

      const where = params.source
        ? eq(series.source, params.source)
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
    ): Promise<SeriesRow> {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.posterUrl !== undefined) updateData.posterUrl = input.posterUrl;

      const [row] = await db
        .update(series)
        .set(updateData)
        .where(eq(series.id, id))
        .returning();

      if (!row) {
        throw new SeriesNotFoundError(`Series with id ${id} not found`);
      }

      return row;
    },

    async deleteSeries(id: string): Promise<SeriesRow> {
      await db
        .update(episodes)
        .set({ seriesId: null })
        .where(eq(episodes.seriesId, id));

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