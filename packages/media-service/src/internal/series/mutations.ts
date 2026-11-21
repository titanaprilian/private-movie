import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  episodes,
  seasons,
  series,
  seriesToGenres,
  type SeriesRow,
} from "@repo/db";
import {
  compareSeasons,
  SeriesHighlightWithoutOngoingError,
  SeriesNotFoundError,
  type SeriesUpsertInput,
  type SeriesWithSeasons,
  type UpdateSeriesInput,
} from "./types";

export async function upsert<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>, input: SeriesUpsertInput): Promise<SeriesRow> {
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
        ...(input.posterUrl !== undefined
          ? { posterUrl: input.posterUrl }
          : {}),
        ...(input.backdropUrl !== undefined
          ? { backdropUrl: input.backdropUrl }
          : {}),
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.tmdbId !== undefined ? { tmdbId: input.tmdbId } : {}),
        ...(input.tmdbSyncStatus !== undefined
          ? { tmdbSyncStatus: input.tmdbSyncStatus }
          : {}),
        updatedAt: now,
      },
    })
    .returning();
  return row;
}

export async function updateSeries<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  id: string,
  input: UpdateSeriesInput,
): Promise<SeriesWithSeasons> {
  const now = new Date();
  const updateData: Record<string, unknown> = {
    updatedAt: now,
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.posterUrl !== undefined) updateData.posterUrl = input.posterUrl;
  if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
  if (input.backdropUrl !== undefined)
    updateData.backdropUrl = input.backdropUrl;
  if (input.rating !== undefined) updateData.rating = input.rating;
  if (input.tmdbId !== undefined) updateData.tmdbId = input.tmdbId;
  if (input.tmdbSyncStatus !== undefined)
    updateData.tmdbSyncStatus = input.tmdbSyncStatus;
  if (input.isFeatured !== undefined) updateData.isFeatured = input.isFeatured;
  if (input.isOngoingHighlighted !== undefined)
    updateData.isOngoingHighlighted = input.isOngoingHighlighted;

  if (input.isOngoingHighlighted === true) {
    const ongoingQuery = db
      .select({ id: seasons.id })
      .from(seasons)
      .where(and(eq(seasons.seriesId, id), eq(seasons.status, "ongoing")));
    const ongoing =
      ongoingQuery &&
      typeof ongoingQuery === "object" &&
      "limit" in ongoingQuery &&
      typeof ongoingQuery.limit === "function"
        ? await ongoingQuery.limit(1)
        : await ongoingQuery;
    if (!ongoing || (Array.isArray(ongoing) && ongoing.length === 0)) {
      throw new SeriesHighlightWithoutOngoingError();
    }
  }

  const [row] = await db
    .update(series)
    .set(updateData)
    .where(eq(series.id, id))
    .returning();

  if (!row) {
    throw new SeriesNotFoundError(`Series with id ${id} not found`);
  }

  if (input.genreIds !== undefined) {
    await db.delete(seriesToGenres).where(eq(seriesToGenres.seriesId, id));

    if (input.genreIds.length > 0) {
      await db.insert(seriesToGenres).values(
        input.genreIds.map((genreId) => ({
          seriesId: id,
          genreId,
        })),
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
      asc(seasons.createdAt),
    );

  childSeasons.sort(compareSeasons);

  return {
    ...row,
    seasons: childSeasons,
  };
}

export async function deleteSeries<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>, id: string): Promise<SeriesRow> {
  const childSeasons = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.seriesId, id));
  const seasonIds = childSeasons.map((s) => s.id);

  if (seasonIds.length > 0) {
    await db.delete(episodes).where(inArray(episodes.seasonId, seasonIds));
  }

  const [row] = await db.delete(series).where(eq(series.id, id)).returning();

  if (!row) {
    throw new SeriesNotFoundError(`Series with id ${id} not found`);
  }

  return row;
}
