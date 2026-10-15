import { randomUUID } from "node:crypto";
import { and, count, eq, isNotNull, ne } from "drizzle-orm";
import { episodes, seasons, series, type DbClient, type SeasonRow } from "@repo/db";
import {
  SeasonAlreadyExistsError,
  SeasonNotEmptyError,
  SeasonNotFoundError,
} from "./errors";
import type {
  CreateSeasonInput,
  SeasonRepository,
  SeasonUpsertInput,
  UpdateSeasonInput,
} from "./types";

export function createSeasonRepository(db: DbClient): SeasonRepository {
  async function clearHighlightIfNoOngoing(
    seriesId: string,
    runner?: { select: never; update: never },
  ): Promise<void> {
    const client = (runner ?? db) as DbClient;
    const remainingQuery = client
      .select({ id: seasons.id })
      .from(seasons)
      .where(and(eq(seasons.seriesId, seriesId), eq(seasons.status, "ongoing")));
    // Support mock db shapes in unit tests that lack `.limit()`.
    const remaining =
      typeof (remainingQuery as { limit?: unknown }).limit === "function"
        ? await (remainingQuery as { limit: (n: number) => Promise<{ id: string }[]> }).limit(1)
        : await remainingQuery;
    if (!remaining || remaining.length === 0) {
      await client
        .update(series)
        .set({ isOngoingHighlighted: false, updatedAt: new Date() })
        .where(and(eq(series.id, seriesId), eq(series.isOngoingHighlighted, true)));
    }
  }

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
          ...(input.scraperUrl !== undefined ? { scraperUrl: input.scraperUrl } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.episodeOffset !== undefined ? { episodeOffset: input.episodeOffset } : {}),
          ...(input.lastScrapedAt !== undefined ? { lastScrapedAt: input.lastScrapedAt } : {}),
          ...(input.lastScrapeError !== undefined ? { lastScrapeError: input.lastScrapeError } : {}),
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
            ...(input.scraperUrl !== undefined ? { scraperUrl: input.scraperUrl } : {}),
            ...(input.source !== undefined ? { source: input.source } : {}),
            ...(input.episodeOffset !== undefined ? { episodeOffset: input.episodeOffset } : {}),
            ...(input.lastScrapedAt !== undefined ? { lastScrapedAt: input.lastScrapedAt } : {}),
            ...(input.lastScrapeError !== undefined ? { lastScrapeError: input.lastScrapeError } : {}),
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
            eq(seasons.seasonNumber, seasonNumber),
          ),
        );
      return row ?? null;
    },

    async findById(id: string): Promise<SeasonRow | null> {
      const [row] = await db.select().from(seasons).where(eq(seasons.id, id));
      return row ?? null;
    },

    async updateSeason(id: string, input: UpdateSeasonInput): Promise<SeasonRow> {
      const now = new Date();
      const [existing] = await db.select().from(seasons).where(eq(seasons.id, id));
      if (!existing) {
        throw new SeasonNotFoundError(`Season with id ${id} not found`);
      }

      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.posterUrl !== undefined) updateData.posterUrl = input.posterUrl;
      if (input.seasonNumber !== undefined) updateData.seasonNumber = input.seasonNumber;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.scraperUrl !== undefined) updateData.scraperUrl = input.scraperUrl;
      if (input.source !== undefined) updateData.source = input.source;
      if (input.episodeOffset !== undefined) updateData.episodeOffset = input.episodeOffset;
      if (input.lastScrapedAt !== undefined) updateData.lastScrapedAt = input.lastScrapedAt;
      if (input.lastScrapeError !== undefined) updateData.lastScrapeError = input.lastScrapeError;
      if (input.tmdbSyncStatus !== undefined) updateData.tmdbSyncStatus = input.tmdbSyncStatus;

      // Enforce single-ongoing invariant atomically with the status change.
      if (input.status === "ongoing") {
        return await db.transaction(async (tx) => {
          await tx
            .update(seasons)
            .set({ status: "completed", updatedAt: now })
            .where(
              and(
                eq(seasons.seriesId, existing.seriesId),
                eq(seasons.status, "ongoing"),
                ne(seasons.id, id),
              ),
            );
          const [row] = await tx
            .update(seasons)
            .set(updateData)
            .where(eq(seasons.id, id))
            .returning();
          if (!row) {
            throw new SeasonNotFoundError(`Season with id ${id} not found`);
          }
          return row;
        });
      }

      const [row] = await db
        .update(seasons)
        .set(updateData)
        .where(eq(seasons.id, id))
        .returning();

      if (!row) {
        throw new SeasonNotFoundError(`Season with id ${id} not found`);
      }

      if (input.status !== undefined && input.status !== "ongoing") {
        await clearHighlightIfNoOngoing(existing.seriesId);
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
      const [existing] = await db.select().from(seasons).where(eq(seasons.id, id));
      if (!existing) {
        throw new SeasonNotFoundError(`Season with id ${id} not found`);
      }

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

      if (existing.status === "ongoing") {
        await clearHighlightIfNoOngoing(existing.seriesId);
      }
    },

    async findOngoingWithScraperUrl(): Promise<SeasonRow[]> {
      return await db
        .select()
        .from(seasons)
        .where(and(eq(seasons.status, "ongoing"), isNotNull(seasons.scraperUrl)));
    },

    async create(input: CreateSeasonInput): Promise<SeasonRow> {
      const now = new Date();
      const id = randomUUID();

      return await db.transaction(async (tx) => {
        // Enforce unique (seriesId, seasonNumber) with a domain error
        // instead of leaking a raw Postgres unique-violation.
        if (input.seasonNumber !== undefined && input.seasonNumber !== null) {
          const [conflict] = await tx
            .select({ id: seasons.id })
            .from(seasons)
            .where(
              and(
                eq(seasons.seriesId, input.seriesId),
                eq(seasons.seasonNumber, input.seasonNumber),
              ),
            );
          if (conflict) {
            throw new SeasonAlreadyExistsError(
              `Season number ${input.seasonNumber} already exists for this series`,
            );
          }
        }

        // Enforce single-ongoing invariant: demote any existing ongoing
        // season in the same series before inserting the new ongoing one.
        if (input.status === "ongoing") {
          await tx
            .update(seasons)
            .set({ status: "completed", updatedAt: now })
            .where(and(eq(seasons.seriesId, input.seriesId), eq(seasons.status, "ongoing")));
        }

        const [row] = await tx
          .insert(seasons)
          .values({
            id,
            seriesId: input.seriesId,
            title: input.title,
            description: input.description ?? null,
            posterUrl: input.posterUrl ?? null,
            seasonNumber: input.seasonNumber ?? null,
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.scraperUrl !== undefined ? { scraperUrl: input.scraperUrl } : {}),
            ...(input.source !== undefined ? { source: input.source } : {}),
            ...(input.episodeOffset !== undefined ? { episodeOffset: input.episodeOffset } : {}),
            tmdbSyncStatus: "PENDING",
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        return row;
      });
    },
  };
}
