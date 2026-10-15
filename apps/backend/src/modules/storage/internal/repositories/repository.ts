import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  episodes,
  seasons,
  series,
  storageProviders,
  system,
  videoSources,
  type StorageProviderRow,
  type VideoSourceRow,
} from "@repo/db";

export interface CorrelatedSourceRow {
  id: string;
  episodeId: string;
  type: string;
  url: string;
  label: string;
  quality: string | null;
  storageProviderId: string | null;
  episodeTitle: string | null;
  episodeOrder: number | null;
  seasonId: string | null;
  seasonNumber: number | null;
  seasonTitle: string | null;
  seriesId: string | null;
  seriesTitle: string | null;
}

export interface MinioProviderRow {
  id: string;
  endpoint: string;
  bucket: string;
  isDefault: boolean | null;
  isEnabled: boolean | null;
}

export function storageRepository<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>) {
  return {
    async getSystemLimitValue(): Promise<string | null> {
      const [sysRow] = await db
        .select()
        .from(system)
        .where(eq(system.key, "s3_storage_limit_gb"));
      return sysRow?.value ?? null;
    },

    async upsertSystemLimit(limitGb: number): Promise<void> {
      const now = new Date();
      await db
        .insert(system)
        .values({
          id: randomUUID(),
          key: "s3_storage_limit_gb",
          value: String(limitGb),
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: system.key,
          set: {
            value: String(limitGb),
          },
        });
    },

    async listProviders(): Promise<StorageProviderRow[]> {
      return db
        .select()
        .from(storageProviders)
        .orderBy(storageProviders.createdAt);
    },

    async findProviderById(id: string): Promise<StorageProviderRow | null> {
      const [provider] = await db
        .select()
        .from(storageProviders)
        .where(eq(storageProviders.id, id));
      return provider ?? null;
    },

    async listMinioProviders(): Promise<MinioProviderRow[]> {
      return db
        .select({
          id: storageProviders.id,
          endpoint: storageProviders.endpoint,
          bucket: storageProviders.bucket,
          isDefault: storageProviders.isDefault,
          isEnabled: storageProviders.isEnabled,
        })
        .from(storageProviders)
        .where(eq(storageProviders.providerType, "minio"));
    },

    async findMinioProvider(
      endpoint: string,
      bucket: string
    ): Promise<StorageProviderRow | null> {
      const [match] = await db
        .select()
        .from(storageProviders)
        .where(
          and(
            eq(storageProviders.providerType, "minio"),
            eq(storageProviders.endpoint, endpoint),
            eq(storageProviders.bucket, bucket)
          )
        );
      return match ?? null;
    },

    async unsetDefaultProviders(): Promise<void> {
      const now = new Date();
      await db
        .update(storageProviders)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(storageProviders.isDefault, true));
    },

    async insertProvider(
      values: typeof storageProviders.$inferInsert
    ): Promise<StorageProviderRow> {
      const [row] = await db.insert(storageProviders).values(values).returning();
      return row!;
    },

    async updateProvider(
      id: string,
      values: Partial<typeof storageProviders.$inferInsert>
    ): Promise<StorageProviderRow | null> {
      const [updated] = await db
        .update(storageProviders)
        .set(values)
        .where(eq(storageProviders.id, id))
        .returning();
      return updated ?? null;
    },

    async setProviderLimit(
      id: string,
      limitGb: number
    ): Promise<StorageProviderRow | null> {
      const [updated] = await db
        .update(storageProviders)
        .set({
          storageLimitGb: limitGb,
          updatedAt: new Date(),
        })
        .where(eq(storageProviders.id, id))
        .returning();
      return updated ?? null;
    },

    async deleteProvider(id: string): Promise<void> {
      await db.delete(storageProviders).where(eq(storageProviders.id, id));
    },

    async listVideoSourceProviderIds(): Promise<
      { storageProviderId: string | null }[]
    > {
      return db
        .select({ storageProviderId: videoSources.storageProviderId })
        .from(videoSources);
    },

    async listVideoSourceIdsForProvider(id: string): Promise<{ id: string }[]> {
      return db
        .select({ id: videoSources.id })
        .from(videoSources)
        .where(eq(videoSources.storageProviderId, id));
    },

    async hasLinkedSources(id: string): Promise<boolean> {
      const linkedSources = await db
        .select({ id: videoSources.id })
        .from(videoSources)
        .where(eq(videoSources.storageProviderId, id))
        .limit(1);
      return linkedSources.length > 0;
    },

    async findVideoSourceById(id: string): Promise<VideoSourceRow | null> {
      const [existing] = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.id, id));
      return existing ?? null;
    },

    async updateVideoSource(
      id: string,
      values: Partial<typeof videoSources.$inferInsert>
    ): Promise<VideoSourceRow | null> {
      const [updated] = await db
        .update(videoSources)
        .set(values)
        .where(eq(videoSources.id, id))
        .returning();
      return updated ?? null;
    },

    async insertVideoSource(
      values: typeof videoSources.$inferInsert
    ): Promise<VideoSourceRow> {
      const [created] = await db
        .insert(videoSources)
        .values(values)
        .returning();
      return created!;
    },

    async deleteVideoSources(ids: string[]): Promise<void> {
      await db.delete(videoSources).where(inArray(videoSources.id, ids));
    },

    async findEpisodeById(id: string) {
      const [existingEp] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, id));
      return existingEp ?? null;
    },

    async listCorrelatedSources(): Promise<CorrelatedSourceRow[]> {
      return db
        .select({
          id: videoSources.id,
          episodeId: videoSources.episodeId,
          type: videoSources.type,
          url: videoSources.url,
          label: videoSources.label,
          quality: videoSources.quality,
          storageProviderId: videoSources.storageProviderId,
          episodeTitle: episodes.title,
          episodeOrder: episodes.order,
          seasonId: seasons.id,
          seasonNumber: seasons.seasonNumber,
          seasonTitle: seasons.title,
          seriesId: series.id,
          seriesTitle: series.title,
        })
        .from(videoSources)
        .leftJoin(episodes, eq(videoSources.episodeId, episodes.id))
        .leftJoin(seasons, eq(episodes.seasonId, seasons.id))
        .leftJoin(series, eq(seasons.seriesId, series.id));
    },
  };
}

export type StorageRepository = ReturnType<typeof storageRepository>;
