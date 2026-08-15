import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { series, type SeriesRow } from "@repo/db";

export class SeriesNotFoundError extends Error {
  constructor(message = "Series not found") {
    super(message);
    this.name = "SeriesNotFoundError";
  }
}

export interface SeriesUpsertInput {
  sourceUrl: string;
  source: string;
  title: string;
  description: string | null;
  posterUrl: string | null;
}

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

    async list(): Promise<SeriesRow[]> {
      return db.select().from(series).orderBy(series.title);
    },
  };
}