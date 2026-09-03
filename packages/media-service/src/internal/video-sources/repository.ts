import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { videoSources, type VideoSourceRow } from "@repo/db";
import { normalizeVideoSource, normalizeVideoSources } from "../playback/normalization";

export class VideoSourceNotFoundError extends Error {
  constructor(message = "Video source not found") {
    super(message);
    this.name = "VideoSourceNotFoundError";
  }
}

export interface VideoSourceUpsertInput {
  id?: string;
  episodeId: string;
  type: string;
  url: string;
  label: string;
  quality?: string | null;
}

export interface UpdateVideoSourceInput {
  type?: string;
  url?: string;
  label?: string;
  quality?: string | null;
}

export function createVideoSourceRepositoryInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>) {
  return {
    async upsert(input: VideoSourceUpsertInput): Promise<VideoSourceRow> {
      const now = new Date();
      const [row] = await db
        .insert(videoSources)
        .values({
          id: input.id ?? randomUUID(),
          episodeId: input.episodeId,
          type: input.type,
          url: input.url,
          label: input.label,
          quality: input.quality ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [videoSources.episodeId, videoSources.url],
          set: {
            type: input.type,
            label: input.label,
            quality: input.quality ?? null,
            updatedAt: now,
          },
        })
        .returning();
      return row ? normalizeVideoSource(row) : row;
    },

    async findById(id: string): Promise<VideoSourceRow | null> {
      const [row] = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.id, id));
      return row ? normalizeVideoSource(row) : null;
    },

    async findByEpisodeId(episodeId: string): Promise<VideoSourceRow[]> {
      const rows = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.episodeId, episodeId))
        .orderBy(asc(videoSources.createdAt));
      return normalizeVideoSources(rows);
    },

    async update(
      id: string,
      input: Partial<UpdateVideoSourceInput>
    ): Promise<VideoSourceRow> {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.type !== undefined) updateData.type = input.type;
      if (input.url !== undefined) updateData.url = input.url;
      if (input.label !== undefined) updateData.label = input.label;
      if (input.quality !== undefined) updateData.quality = input.quality;

      const [row] = await db
        .update(videoSources)
        .set(updateData)
        .where(eq(videoSources.id, id))
        .returning();

      if (!row) {
        throw new VideoSourceNotFoundError(`Video source with id ${id} not found`);
      }

      return normalizeVideoSource(row);
    },

    async delete(id: string): Promise<VideoSourceRow> {
      const [row] = await db
        .delete(videoSources)
        .where(eq(videoSources.id, id))
        .returning();

      if (!row) {
        throw new VideoSourceNotFoundError(`Video source with id ${id} not found`);
      }

      return row;
    },

    async deleteByEpisodeId(episodeId: string): Promise<VideoSourceRow[]> {
      const rows = await db
        .delete(videoSources)
        .where(eq(videoSources.episodeId, episodeId))
        .returning();
      return rows;
    },
  };
}
