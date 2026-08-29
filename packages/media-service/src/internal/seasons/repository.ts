import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { episodes, seasons, type SeasonRow } from "@repo/db";

export class SeasonNotFoundError extends Error {
  constructor(message = "Season not found") {
    super(message);
    this.name = "SeasonNotFoundError";
  }
}

export class SeasonNotLinkedToTmdbError extends Error {
  constructor(message = "Season is not linked to TMDB") {
    super(message);
    this.name = "SeasonNotLinkedToTmdbError";
  }
}

export class SeasonNotEmptyError extends Error {
  readonly episodeCount: number;
  constructor(episodeCount: number) {
    super(`Season still contains ${episodeCount} episode(s) and cannot be deleted`);
    this.name = "SeasonNotEmptyError";
    this.episodeCount = episodeCount;
  }
}

export interface SeasonUpsertInput {
  seriesId: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  seasonNumber?: number | null;
  status?: "ongoing" | "completed" | "pending" | string;
  tmdbSyncStatus?: "PENDING" | "SYNCED" | "FAILED";
}

export interface CreateSeasonInput {
  seriesId: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  seasonNumber?: number | null;
  status?: "ongoing" | "completed" | "pending" | string;
}

export interface UpdateSeasonInput {
  title?: string;
  description?: string | null;
  posterUrl?: string | null;
  seasonNumber?: number | null;
  status?: "ongoing" | "completed" | "pending" | string;
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
          title: input.title,
          description: input.description ?? null,
          posterUrl: input.posterUrl ?? null,
          seasonNumber: input.seasonNumber ?? null,
          ...(input.status !== undefined ? { status: input.status } : {}),
          tmdbSyncStatus: input.tmdbSyncStatus ?? "PENDING",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [seasons.seriesId, seasons.seasonNumber],
          set: {
            seriesId: input.seriesId,
            title: input.title,
            description: input.description ?? null,
            posterUrl: input.posterUrl ?? null,
            ...(input.seasonNumber !== undefined ? { seasonNumber: input.seasonNumber } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.tmdbSyncStatus !== undefined ? { tmdbSyncStatus: input.tmdbSyncStatus } : {}),
            updatedAt: now,
          },
        })
        .returning();
      return row;
    },

    async findBySeriesIdAndSeasonNumber(seriesId: string, seasonNumber: number): Promise<SeasonRow | null> {
      const [row] = await db
        .select()
        .from(seasons)
        .where(
          and(
            eq(seasons.seriesId, seriesId),
            eq(seasons.seasonNumber, seasonNumber)
          )
        );
      return row ?? null;
    },

    async findById(id: string): Promise<SeasonRow | null> {
      const [row] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.id, id));
      return row ?? null;
    },

    async updateSeason(id: string, input: UpdateSeasonInput): Promise<SeasonRow> {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.posterUrl !== undefined) updateData.posterUrl = input.posterUrl;
      if (input.seasonNumber !== undefined) updateData.seasonNumber = input.seasonNumber;
      if (input.status !== undefined) updateData.status = input.status;
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

    async deleteSeason(id: string): Promise<void> {
      const [{ value }] = await db
        .select({ value: count() })
        .from(episodes)
        .where(eq(episodes.seasonId, id));

      if (value > 0) {
        throw new SeasonNotEmptyError(value);
      }

      const result = await db.delete(seasons).where(eq(seasons.id, id)).returning();
      if (result.length === 0) {
        throw new SeasonNotFoundError(`Season with id ${id} not found`);
      }
    },

    async create(input: CreateSeasonInput): Promise<SeasonRow> {
      const now = new Date();
      const id = randomUUID();
      const [row] = await db
        .insert(seasons)
        .values({
          id,
          seriesId: input.seriesId,
          title: input.title,
          description: input.description ?? null,
          posterUrl: input.posterUrl ?? null,
          seasonNumber: input.seasonNumber ?? null,
          ...(input.status !== undefined ? { status: input.status } : {}),
          tmdbSyncStatus: "PENDING",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    },
  };
}
