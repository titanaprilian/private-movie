import { randomUUID } from "node:crypto";
import { and, eq, ne, or } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { genres, type GenreRow } from "@repo/db";
import { GenreAlreadyExistsError, GenreNotFoundError } from "./errors";

export interface CreateGenreInput {
  name: string;
  slug: string;
}

export interface UpdateGenreInput {
  name: string;
  slug: string;
}

export function createGenreRepositoryInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>) {
  return {
    async findAll(): Promise<GenreRow[]> {
      return db.select().from(genres);
    },

    async findById(id: string): Promise<GenreRow | null> {
      const [row] = await db.select().from(genres).where(eq(genres.id, id));
      return row ?? null;
    },

    async create(input: CreateGenreInput): Promise<GenreRow> {
      const existing = await db
        .select()
        .from(genres)
        .where(or(eq(genres.name, input.name), eq(genres.slug, input.slug)));

      if (existing.length > 0) {
        throw new GenreAlreadyExistsError();
      }

      const id = randomUUID();
      const now = new Date();

      const [row] = await db
        .insert(genres)
        .values({
          id,
          name: input.name,
          slug: input.slug,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return row;
    },

    async update(id: string, input: UpdateGenreInput): Promise<GenreRow> {
      const existingGenre = await db
        .select()
        .from(genres)
        .where(eq(genres.id, id));

      if (existingGenre.length === 0) {
        throw new GenreNotFoundError();
      }

      const conflict = await db
        .select()
        .from(genres)
        .where(
          and(
            ne(genres.id, id),
            or(eq(genres.name, input.name), eq(genres.slug, input.slug))
          )
        );

      if (conflict.length > 0) {
        throw new GenreAlreadyExistsError();
      }

      const now = new Date();
      const [updated] = await db
        .update(genres)
        .set({
          name: input.name,
          slug: input.slug,
          updatedAt: now,
        })
        .where(eq(genres.id, id))
        .returning();

      return updated;
    },

    async delete(id: string): Promise<GenreRow> {
      const existingGenre = await db
        .select()
        .from(genres)
        .where(eq(genres.id, id));

      if (existingGenre.length === 0) {
        throw new GenreNotFoundError();
      }

      const [deleted] = await db
        .delete(genres)
        .where(eq(genres.id, id))
        .returning();

      return deleted;
    },
  };
}
