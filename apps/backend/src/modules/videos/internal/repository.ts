import { randomUUID } from "node:crypto";
import { count, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { videos, type VideoRow } from "@repo/db";
import type { ParsedMetadata } from "./parse";

export class VideoNotFoundError extends Error {
  constructor(message = "Video not found") {
    super(message);
    this.name = "VideoNotFoundError";
  }
}

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

export interface UpdateVideoInput {
  title: string;
  videoUrl: string;
  videoType: string | null;
  metadata: Record<string, unknown>;
}

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

    async updateVideo(
      id: string,
      input: Partial<UpdateVideoInput>
    ): Promise<VideoRow> {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.videoUrl !== undefined) updateData.videoUrl = input.videoUrl;
      if (input.videoType !== undefined) updateData.videoType = input.videoType;
      if (input.metadata !== undefined) updateData.metadata = input.metadata;

      const [row] = await db
        .update(videos)
        .set(updateData)
        .where(eq(videos.id, id))
        .returning();

      if (!row) {
        throw new VideoNotFoundError(`Video with id ${id} not found`);
      }

      return row;
    },

    async deleteVideo(id: string): Promise<VideoRow> {
      const [row] = await db
        .delete(videos)
        .where(eq(videos.id, id))
        .returning();

      if (!row) {
        throw new VideoNotFoundError(`Video with id ${id} not found`);
      }

      return row;
    },
  };
}