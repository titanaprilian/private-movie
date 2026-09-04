import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, isNull, max } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { episodes, videoSources, type EpisodeRow, type VideoSourceRow } from "@repo/db";
import { normalizeVideoSourceSync, normalizeVideoSources } from "../playback/normalization";
import type { ParsedMetadata } from "@repo/media-scraper";
import { extractS3Key, type S3StorageService } from "../s3/s3-storage-service";

export interface EpisodeRepositoryOptions {
  s3StorageService?: S3StorageService;
}


export class EpisodeNotFoundError extends Error {
  constructor(message = "Episode not found") {
    super(message);
    this.name = "EpisodeNotFoundError";
  }
}

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

export type EpisodeWithVideoSources = EpisodeRow & {
  videoSources: VideoSourceRow[];
};

export interface UpdateEpisodeInput {
  title?: string;
  description?: string | null;
}

export interface EpisodeOrderUpdateInput {
  id: string;
  order: number;
  seasonId?: string;
}

export interface EpisodeUpsertInput {
  seasonId?: string | null;
  seriesId?: string | null;
  title: string;
  order?: number;
  description?: string | null;
  duration?: number | null;
  tmdbId?: number | null;
  thumbnailUrl?: string | null;
  rating?: string | null;
  airDate?: Date | null;
}

export interface EpisodeListParams {
  page: number;
  limit?: number;
  seasonId?: string;
}

export interface EpisodeListResult {
  episodes: EpisodeWithVideoSources[];
  total: number;
}

export function createEpisodeRepositoryInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>, options?: EpisodeRepositoryOptions) {
  return {
    async upsert(input: EpisodeUpsertInput): Promise<EpisodeRow> {
      const now = new Date();
      const seasonId = input.seasonId ?? input.seriesId;
      if (!seasonId) {
        throw new Error("seasonId is required for episode upsert");
      }
      const order = input.order ?? 1;

      const [row] = await db
        .insert(episodes)
        .values({
          id: randomUUID(),
          title: input.title,
          order,
          description: input.description ?? null,
          duration: input.duration ?? null,
          seasonId,
          thumbnailUrl: input.thumbnailUrl ?? null,
          rating: input.rating ?? null,
          airDate: input.airDate ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [episodes.seasonId, episodes.order],
          set: {
            title: input.title,
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.duration !== undefined ? { duration: input.duration } : {}),
            ...(input.thumbnailUrl !== undefined ? { thumbnailUrl: input.thumbnailUrl } : {}),
            ...(input.rating !== undefined ? { rating: input.rating } : {}),
            ...(input.airDate !== undefined ? { airDate: input.airDate } : {}),
            updatedAt: now,
          },
        })
        .returning();
      return row;
    },

    async findBySeasonIdAndOrder(seasonId: string, order: number): Promise<EpisodeRow | null> {
      const [row] = await db
        .select()
        .from(episodes)
        .where(and(eq(episodes.seasonId, seasonId), eq(episodes.order, order)));
      return row ?? null;
    },

    async findById(id: string): Promise<EpisodeWithVideoSources | null> {
      const [row] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, id));
      if (!row) return null;

      const sources = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.episodeId, id))
        .orderBy(asc(videoSources.createdAt));

      const normalizedSources = await normalizeVideoSources(sources, {
        s3StorageService: options?.s3StorageService,
      });

      return {
        ...row,
        videoSources: normalizedSources,
      };
    },

    async getMaxOrder(seasonId: string | null): Promise<number> {
      const whereClause = seasonId
        ? eq(episodes.seasonId, seasonId)
        : isNull(episodes.seasonId);
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

      const where = params.seasonId
        ? eq(episodes.seasonId, params.seasonId)
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

      const episodeIds = rows.map((r) => r.id);
      const sourcesMap = new Map<string, VideoSourceRow[]>();

      if (episodeIds.length > 0) {
        const sources = await db
          .select()
          .from(videoSources)
          .where(inArray(videoSources.episodeId, episodeIds))
          .orderBy(asc(videoSources.createdAt));

        const normalizedSources = await normalizeVideoSources(sources, {
          s3StorageService: options?.s3StorageService,
        });

        for (const s of normalizedSources) {
          const list = sourcesMap.get(s.episodeId) ?? [];
          list.push(s);
          sourcesMap.set(s.episodeId, list);
        }
      }

      const episodesWithSources = rows.map((ep) => ({
        ...ep,
        videoSources: sourcesMap.get(ep.id) ?? [],
      }));

      return {
        episodes: episodesWithSources,
        total: totalRows[0]?.value ?? 0,
      };
    },

    async updateEpisode(
      id: string,
      input: Partial<UpdateEpisodeInput>
    ): Promise<EpisodeWithVideoSources> {
      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;

      const [row] = await db
        .update(episodes)
        .set(updateData)
        .where(eq(episodes.id, id))
        .returning();

      if (!row) {
        throw new EpisodeNotFoundError(`Episode with id ${id} not found`);
      }

      const sources = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.episodeId, id))
        .orderBy(asc(videoSources.createdAt));

      const normalizedSources = await normalizeVideoSources(sources, {
        s3StorageService: options?.s3StorageService,
      });

      return {
        ...row,
        videoSources: normalizedSources,
      };
    },

    async updateOrders(items: EpisodeOrderUpdateInput[]): Promise<void> {
      await db.transaction(async (tx) => {
        const now = new Date();

        // Phase 1: park every moved row on a unique negative order so any
        // combination of final positions can be applied without tripping the
        // (season_id, order) unique constraint mid-transaction.
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const [updated] = await tx
            .update(episodes)
            .set({
              order: -(i + 100000),
              updatedAt: now,
            })
            .where(eq(episodes.id, item.id))
            .returning({ id: episodes.id });

          if (!updated) {
            throw new EpisodeNotFoundError(`Episode with id ${item.id} not found`);
          }
        }

        // Phase 2: re-parent rows across seasons while they still hold their
        // negative parking orders — occupants of the target season all have
        // positive orders, so no collision is possible at this point.
        for (const item of items) {
          if (item.seasonId === undefined) continue;
          await tx
            .update(episodes)
            .set({
              seasonId: item.seasonId,
              updatedAt: now,
            })
            .where(eq(episodes.id, item.id));
        }

        // Phase 3: commit the final absolute positions.
        for (const item of items) {
          await tx
            .update(episodes)
            .set({
              order: item.order,
              updatedAt: now,
            })
            .where(eq(episodes.id, item.id));
        }
      });
    },

    async deleteEpisode(id: string): Promise<EpisodeRow> {
      // Collect raw S3 keys before the DB delete cascades video_sources rows.
      // Must read the raw table (not findById) so presigned-URL normalization
      // does not rewrite the stored object keys.
      let s3Keys: string[] = [];
      const s3 = options?.s3StorageService;
      if (s3?.isConfigured()) {
        try {
          const existing = await db
            .select()
            .from(videoSources)
            .where(eq(videoSources.episodeId, id));
          s3Keys = existing
            .filter((src) => src.type === "s3")
            .map((src) => extractS3Key(src.url))
            .filter((key): key is string => Boolean(key));
        } catch {
          // If the pre-fetch fails, still attempt the DB delete below.
          s3Keys = [];
        }
      }

      const [row] = await db
        .delete(episodes)
        .where(eq(episodes.id, id))
        .returning();

      if (!row) {
        throw new EpisodeNotFoundError(`Episode with id ${id} not found`);
      }

      // Best-effort S3 object cleanup: DB deletion must succeed even if the
      // remote delete fails (logged as a warning instead).
      if (s3Keys.length > 0 && s3?.isConfigured()) {
        try {
          await s3.deleteObjects(s3Keys);
        } catch (err) {
          console.warn(
            `[media-service] Failed to delete ${s3Keys.length} S3 object(s) for episode ${id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      return row;
    },
  };
}
