import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { videoSources, type VideoSourceRow } from "@repo/db";
import { normalizeVideoSource, normalizeVideoSources } from "../playback/normalization";
import { extractS3Key, type S3StorageService } from "../s3/s3-storage-service";
import type { StorageProviderRegistry } from "../s3/registry";

export interface VideoSourceRepositoryOptions {
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

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
  storageProviderId?: string | null;
}

export interface UpdateVideoSourceInput {
  type?: string;
  url?: string;
  label?: string;
  quality?: string | null;
  storageProviderId?: string | null;
}

export function createVideoSourceRepositoryInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>, options?: VideoSourceRepositoryOptions) {
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
          storageProviderId: input.storageProviderId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [videoSources.episodeId, videoSources.url],
          set: {
            type: input.type,
            label: input.label,
            quality: input.quality ?? null,
            storageProviderId: input.storageProviderId ?? null,
            updatedAt: now,
          },
        })
        .returning();
      return row
        ? await normalizeVideoSource(row, {
            s3StorageService: options?.s3StorageService,
            storageProviderRegistry: options?.storageProviderRegistry,
          })
        : row;
    },

    async findById(id: string): Promise<VideoSourceRow | null> {
      const [row] = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.id, id));
      return row
        ? await normalizeVideoSource(row, {
            s3StorageService: options?.s3StorageService,
            storageProviderRegistry: options?.storageProviderRegistry,
          })
        : null;
    },

    async findByEpisodeId(episodeId: string): Promise<VideoSourceRow[]> {
      const rows = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.episodeId, episodeId))
        .orderBy(asc(videoSources.createdAt));
      return await normalizeVideoSources(rows, {
        s3StorageService: options?.s3StorageService,
        storageProviderRegistry: options?.storageProviderRegistry,
      });
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
      if (input.storageProviderId !== undefined) updateData.storageProviderId = input.storageProviderId;

      const [row] = await db
        .update(videoSources)
        .set(updateData)
        .where(eq(videoSources.id, id))
        .returning();

      if (!row) {
        throw new VideoSourceNotFoundError(`Video source with id ${id} not found`);
      }

      return await normalizeVideoSource(row, {
        s3StorageService: options?.s3StorageService,
        storageProviderRegistry: options?.storageProviderRegistry,
      });
    },

    async delete(id: string): Promise<VideoSourceRow> {
      const [row] = await db
        .delete(videoSources)
        .where(eq(videoSources.id, id))
        .returning();

      if (!row) {
        throw new VideoSourceNotFoundError(`Video source with id ${id} not found`);
      }

      // Best-effort S3 object cleanup: DB deletion must succeed even if the
      // remote delete fails (logged as a warning instead).
      if (row.type === "s3") {
        let s3 = options?.s3StorageService;
        if (options?.storageProviderRegistry) {
          const regS3 = await options.storageProviderRegistry.getService(row.storageProviderId);
          if (regS3) s3 = regS3;
        }

        if (s3?.isConfigured()) {
          const key = extractS3Key(row.url);
          if (key) {
            try {
              await s3.deleteObject(key);
            } catch (err) {
              console.warn(
                `[media-service] Failed to delete S3 object for video source ${id} (key: ${key}):`,
                err instanceof Error ? err.message : err
              );
            }
          }
        }
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
