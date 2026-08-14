import { randomUUID } from "node:crypto";
import { count, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { videos, type VideoRow } from "@repo/db";
import type { ParsedMetadata } from "./parse";

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

export interface VideoUpsertInput {
  sourceUrl: string;
  source: string;
  title: string;
  videoType: string | null;
  videoUrl: string;
  metadata: ParsedMetadata;
}

export interface VideoListParams {
  page: number;
  limit?: number;
  source?: string;
}

export interface VideoListResult {
  videos: VideoRow[];
  total: number;
}

export function createVideoRepositoryInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>) {
  return {
    async upsert(input: VideoUpsertInput): Promise<VideoRow> {
      const now = new Date();
      const [row] = await db
        .insert(videos)
        .values({
          id: randomUUID(),
          sourceUrl: input.sourceUrl,
          source: input.source,
          title: input.title,
          videoType: input.videoType,
          videoUrl: input.videoUrl,
          metadata: input.metadata,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: videos.sourceUrl,
          set: {
            source: input.source,
            title: input.title,
            videoType: input.videoType,
            videoUrl: input.videoUrl,
            metadata: input.metadata,
            updatedAt: now,
          },
        })
        .returning();
      return row;
    },

    async findBySourceUrl(sourceUrl: string): Promise<VideoRow | null> {
      const [row] = await db
        .select()
        .from(videos)
        .where(eq(videos.sourceUrl, sourceUrl));
      return row ?? null;
    },

    async list(params: VideoListParams): Promise<VideoListResult> {
      const limit = Math.max(
        1,
        Math.min(params.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
      );
      const page = Math.max(1, params.page);
      const offset = (page - 1) * limit;

      const where = params.source
        ? eq(videos.source, params.source)
        : undefined;

      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(videos)
          .where(where)
          .orderBy(desc(videos.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ value: count() }).from(videos).where(where),
      ]);

      return {
        videos: rows,
        total: totalRows[0]?.value ?? 0,
      };
    },
  };
}