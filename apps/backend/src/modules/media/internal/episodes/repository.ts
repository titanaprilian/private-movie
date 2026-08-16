import { randomUUID } from "node:crypto";
import { asc, count, eq, isNull, max } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { episodes, type EpisodeRow } from "@repo/db";
import type { ParsedMetadata } from "./parse";

export class EpisodeNotFoundError extends Error {
  constructor(message = "Episode not found") {
    super(message);
    this.name = "EpisodeNotFoundError";
  }
}

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

export interface UpdateEpisodeInput {
  title: string;
  videoUrl: string;
  videoType: string | null;
  description?: string | null;
  metadata: Record<string, unknown>;
}

export interface EpisodeUpsertInput {
  sourceUrl: string;
  source: string;
  title: string;
  order?: number;
  videoType: string | null;
  videoUrl: string;
  metadata: ParsedMetadata;
  seriesId?: string | null;
}

export interface EpisodeListParams {
  page: number;
  limit?: number;
  source?: string;
}

export interface EpisodeListResult {
  episodes: EpisodeRow[];
  total: number;
}

export function createEpisodeRepositoryInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>) {
  return {
    async upsert(input: EpisodeUpsertInput): Promise<EpisodeRow> {
      const now = new Date();
      const [row] = await db
        .insert(episodes)
        .values({
          id: randomUUID(),
          sourceUrl: input.sourceUrl,
          source: input.source,
          title: input.title,
          order: input.order ?? 1,
          videoType: input.videoType,
          videoUrl: input.videoUrl,
          metadata: input.metadata,
          seriesId: input.seriesId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: episodes.sourceUrl,
          set: {
            source: input.source,
            title: input.title,
            ...(input.order !== undefined ? { order: input.order } : {}),
            videoType: input.videoType,
            videoUrl: input.videoUrl,
            metadata: input.metadata,
            seriesId: input.seriesId ?? undefined,
            updatedAt: now,
          },
        })
        .returning();
      return row;
    },

    async findBySourceUrl(sourceUrl: string): Promise<EpisodeRow | null> {
      const [row] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.sourceUrl, sourceUrl));
      return row ?? null;
    },

    async getMaxOrder(seriesId: string | null): Promise<number> {
      const whereClause = seriesId
        ? eq(episodes.seriesId, seriesId)
        : isNull(episodes.seriesId);
      const [result] = await db
        .select({ maxOrder: max(episodes.order) })
        .from(episodes)
        .where(whereClause);
      return result?.maxOrder ?? 0;
    },

    async list(params: EpisodeListParams): Promise<EpisodeListResult> {
      const limit = Math.max(
        1,
        Math.min(params.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
      );
      const page = Math.max(1, params.page);
      const offset = (page - 1) * limit;

      const where = params.source
        ? eq(episodes.source, params.source)
        : undefined;

      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(episodes)
          .where(where)
          .orderBy(asc(episodes.order), asc(episodes.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ value: count() }).from(episodes).where(where),
      ]);

      return {
        episodes: rows,
        total: totalRows[0]?.value ?? 0,
      };
    },

    async updateEpisode(
      id: string,
      input: Partial<UpdateEpisodeInput>
    ): Promise<EpisodeRow> {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.videoUrl !== undefined) updateData.videoUrl = input.videoUrl;
      if (input.videoType !== undefined) updateData.videoType = input.videoType;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.metadata !== undefined) updateData.metadata = input.metadata;

      const [row] = await db
        .update(episodes)
        .set(updateData)
        .where(eq(episodes.id, id))
        .returning();

      if (!row) {
        throw new EpisodeNotFoundError(`Episode with id ${id} not found`);
      }

      return row;
    },

    async deleteEpisode(id: string): Promise<EpisodeRow> {
      const [row] = await db
        .delete(episodes)
        .where(eq(episodes.id, id))
        .returning();

      if (!row) {
        throw new EpisodeNotFoundError(`Episode with id ${id} not found`);
      }

      return row;
    },
  };
}