import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { videos, type VideoRow } from "@repo/db";
import type { ParsedMetadata } from "./parse";

export interface VideoUpsertInput {
  sourceUrl: string;
  source: string;
  title: string;
  videoType: string | null;
  videoUrl: string;
  metadata: ParsedMetadata;
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
  };
}