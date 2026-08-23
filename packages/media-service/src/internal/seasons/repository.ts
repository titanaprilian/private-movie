import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { seasons, type SeasonRow } from "@repo/db";

export class SeasonNotFoundError extends Error {
  constructor(message = "Season not found") {
    super(message);
    this.name = "SeasonNotFoundError";
  }
}

export interface SeasonUpsertInput {
  seriesId: string;
  sourceUrl: string;
  source: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  rating?: string | null;
  tmdbId?: number | null;
  tmdbSeason?: number | null;
  tmdbSyncStatus?: "PENDING" | "SYNCED" | "FAILED";
}

export function createSeasonsRepositoryInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>) {
  return {
    async upsert(input: SeasonUpsertInput): Promise<SeasonRow> {
      const now = new Date();
      const [row] = await db
        .insert(seasons)
        .values({
          id: randomUUID(),
          seriesId: input.seriesId,
          sourceUrl: input.sourceUrl,
          source: input.source,
          title: input.title,
          description: input.description ?? null,
          posterUrl: input.posterUrl ?? null,
          backdropUrl: input.backdropUrl ?? null,
          rating: input.rating ?? null,
          tmdbId: input.tmdbId ?? null,
          tmdbSeason: input.tmdbSeason ?? null,
          tmdbSyncStatus: input.tmdbSyncStatus ?? "PENDING",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: seasons.sourceUrl,
          set: {
            seriesId: input.seriesId,
            source: input.source,
            title: input.title,
            description: input.description ?? null,
            posterUrl: input.posterUrl ?? null,
            ...(input.backdropUrl !== undefined ? { backdropUrl: input.backdropUrl } : {}),
            ...(input.rating !== undefined ? { rating: input.rating } : {}),
            ...(input.tmdbId !== undefined ? { tmdbId: input.tmdbId } : {}),
            ...(input.tmdbSeason !== undefined ? { tmdbSeason: input.tmdbSeason } : {}),
            ...(input.tmdbSyncStatus !== undefined ? { tmdbSyncStatus: input.tmdbSyncStatus } : {}),
            updatedAt: now,
          },
        })
        .returning();
      return row;
    },

    async findBySourceUrl(sourceUrl: string): Promise<SeasonRow | null> {
      const [row] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.sourceUrl, sourceUrl));
      return row ?? null;
    },

    async findById(id: string): Promise<SeasonRow | null> {
      const [row] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.id, id));
      return row ?? null;
    },

    async updateSeason(id: string, input: Partial<SeasonUpsertInput>): Promise<SeasonRow> {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.posterUrl !== undefined) updateData.posterUrl = input.posterUrl;
      if (input.backdropUrl !== undefined) updateData.backdropUrl = input.backdropUrl;
      if (input.rating !== undefined) updateData.rating = input.rating;
      if (input.tmdbId !== undefined) updateData.tmdbId = input.tmdbId;
      if (input.tmdbSeason !== undefined) updateData.tmdbSeason = input.tmdbSeason;
      if (input.tmdbSyncStatus !== undefined) updateData.tmdbSyncStatus = input.tmdbSyncStatus;

      const [row] = await db
        .update(seasons)
        .set(updateData)
        .where(eq(seasons.id, id))
        .returning();

      if (!row) {
        throw new SeasonNotFoundError(`Season with id ${id} not found`);
      }

      return row;
    },

    async reparentSeasons(fromSeriesId: string, toSeriesId: string): Promise<void> {
      await db
        .update(seasons)
        .set({ seriesId: toSeriesId, updatedAt: new Date() })
        .where(eq(seasons.seriesId, fromSeriesId));
    },
  };
}
