import { randomUUID } from "node:crypto";
import { asc, count, eq, inArray, isNull, max } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { episodes, videoSources, type EpisodeRow, type VideoSourceRow } from "@repo/db";
import type { ParsedMetadata } from "@repo/media-scraper";

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
  title: string;
  videoType: string | null;
  description?: string | null;
  metadata: Record<string, unknown>;
}

export interface EpisodeOrderUpdateInput {
  id: string;
  order: number;
}

export interface EpisodeUpsertInput {
  sourceUrl: string;
  source: string;
  title: string;
  order?: number;
  videoType: string | null;
  metadata: ParsedMetadata;
  seriesId?: string | null;
}

export interface EpisodeListParams {
  page: number;
  limit?: number;
  source?: string;
}

export interface EpisodeListResult {
  episodes: EpisodeWithVideoSources[];
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

      return {
        ...row,
        videoSources: sources,
      };
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

      const episodeIds = rows.map((r) => r.id);
      const sourcesMap = new Map<string, VideoSourceRow[]>();

      if (episodeIds.length > 0) {
        const sources = await db
          .select()
          .from(videoSources)
          .where(inArray(videoSources.episodeId, episodeIds))
          .orderBy(asc(videoSources.createdAt));

        for (const s of sources) {
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

      const sources = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.episodeId, id))
        .orderBy(asc(videoSources.createdAt));

      return {
        ...row,
        videoSources: sources,
      };
    },

    async updateOrders(items: EpisodeOrderUpdateInput[]): Promise<void> {
      await db.transaction(async (tx) => {
        const now = new Date();
        for (const item of items) {
          const [updated] = await tx
            .update(episodes)
            .set({
              order: item.order,
              updatedAt: now,
            })
            .where(eq(episodes.id, item.id))
            .returning({ id: episodes.id });

          if (!updated) {
            throw new EpisodeNotFoundError(`Episode with id ${item.id} not found`);
          }
        }
      });
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
