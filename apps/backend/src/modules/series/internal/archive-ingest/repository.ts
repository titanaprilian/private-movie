import { and, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  archiveIngestJobs,
  type ArchiveIngestJobRow,
  type NewArchiveIngestJobRow,
} from "@repo/db";
import {
  ARCHIVE_INGEST_ACTIVE_STATUSES,
  type ArchiveIngestJob,
  type ArchiveIngestJobEntry,
  type ArchiveIngestJobStatus,
} from "@repo/contracts";
import type {
  ArchiveIngestJobUpdatePatch,
  ArchiveIngestRepository,
  ExpiredArchiveIngestJob,
  InterruptedArchiveIngestJob,
} from "./types";

/** Statuses counted as occupying a concurrency slot. */
const COUNTED_ACTIVE_STATUSES: ArchiveIngestJobStatus[] = [
  "downloading",
  "listing",
  "uploading",
];

/** Statuses treated as interrupted when the process restarts. */
const INTERRUPTED_STATUSES: ArchiveIngestJobStatus[] = [
  "queued",
  "downloading",
  "listing",
  "uploading",
];

export function mapArchiveIngestRowToJob(row: ArchiveIngestJobRow): ArchiveIngestJob {
  return {
    id: row.id,
    ownerId: row.ownerId,
    seriesId: row.seriesId,
    sourceKey: row.sourceKey,
    sourceUrl: row.sourceUrl,
    referer: row.referer ?? null,
    status: row.status as ArchiveIngestJobStatus,
    stage: row.stage,
    bytesDone: row.bytesDone,
    bytesTotal: row.bytesTotal,
    stagingPath: row.stagingPath,
    archiveFilename: row.archiveFilename,
    entries: (row.entries ?? []) as ArchiveIngestJobEntry[],
    selection: row.selection ?? [],
    storageProviderId: row.storageProviderId,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    expiresAt: row.expiresAt
      ? row.expiresAt instanceof Date
        ? row.expiresAt.toISOString()
        : String(row.expiresAt)
      : null,
  };
}

export function createArchiveIngestRepository<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>): ArchiveIngestRepository {
  return {
    async findActiveJob(ownerId: string, sourceKey: string): Promise<ArchiveIngestJob | null> {
      const rows = await db
        .select()
        .from(archiveIngestJobs)
        .where(
          and(
            eq(archiveIngestJobs.ownerId, ownerId),
            eq(archiveIngestJobs.sourceKey, sourceKey),
            inArray(archiveIngestJobs.status, [...ARCHIVE_INGEST_ACTIVE_STATUSES])
          )
        )
        .limit(1);

      return rows[0] ? mapArchiveIngestRowToJob(rows[0]) : null;
    },

    async countActiveJobs(ownerId?: string): Promise<number> {
      const condition = ownerId
        ? and(
            eq(archiveIngestJobs.ownerId, ownerId),
            inArray(archiveIngestJobs.status, COUNTED_ACTIVE_STATUSES)
          )
        : inArray(archiveIngestJobs.status, COUNTED_ACTIVE_STATUSES);

      const rows = await db
        .select({ count: sql<number>`count(*)` })
        .from(archiveIngestJobs)
        .where(condition);

      return Number(rows[0]?.count ?? 0);
    },

    async createJob(input: NewArchiveIngestJobRow): Promise<ArchiveIngestJob> {
      const [row] = await db
        .insert(archiveIngestJobs)
        .values(input)
        .returning();

      if (!row) {
        throw new Error("Failed to create archive ingest job");
      }
      return mapArchiveIngestRowToJob(row);
    },

    async findById(jobId: string): Promise<ArchiveIngestJob | null> {
      const rows = await db
        .select()
        .from(archiveIngestJobs)
        .where(eq(archiveIngestJobs.id, jobId))
        .limit(1);

      return rows[0] ? mapArchiveIngestRowToJob(rows[0]) : null;
    },

    async findFailedJob(ownerId: string, sourceKey: string): Promise<ArchiveIngestJob | null> {
      const rows = await db
        .select()
        .from(archiveIngestJobs)
        .where(
          and(
            eq(archiveIngestJobs.ownerId, ownerId),
            eq(archiveIngestJobs.sourceKey, sourceKey),
            eq(archiveIngestJobs.status, "failed")
          )
        )
        .orderBy(desc(archiveIngestJobs.updatedAt))
        .limit(1);

      return rows[0] ? mapArchiveIngestRowToJob(rows[0]) : null;
    },

    async updateJob(
      jobId: string,
      patch: ArchiveIngestJobUpdatePatch
    ): Promise<ArchiveIngestJob | null> {
      const [row] = await db
        .update(archiveIngestJobs)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(archiveIngestJobs.id, jobId))
        .returning();

      return row ? mapArchiveIngestRowToJob(row) : null;
    },

    async markInterruptedJobsAsFailed(): Promise<InterruptedArchiveIngestJob[]> {
      const result = await db
        .update(archiveIngestJobs)
        .set({
          status: "failed",
          stage: "failed",
          errorCode: "SERVER_RESTARTED",
          errorMessage: "Server restarted while job was in progress",
          updatedAt: new Date(),
        })
        .where(inArray(archiveIngestJobs.status, INTERRUPTED_STATUSES))
        .returning({ id: archiveIngestJobs.id, stagingPath: archiveIngestJobs.stagingPath });

      return result;
    },

    async findExpiredReadyJobs(now: Date = new Date()): Promise<ArchiveIngestJob[]> {
      const rows = await db
        .select()
        .from(archiveIngestJobs)
        .where(
          and(
            eq(archiveIngestJobs.status, "ready"),
            isNotNull(archiveIngestJobs.expiresAt),
            lte(archiveIngestJobs.expiresAt, now)
          )
        );

      return rows.map(mapArchiveIngestRowToJob);
    },

    async markJobsExpired(
      ids: string[],
      now: Date = new Date()
    ): Promise<ExpiredArchiveIngestJob[]> {
      if (ids.length === 0) return [];

      const result = await db
        .update(archiveIngestJobs)
        .set({
          status: "expired",
          stage: "expired",
          updatedAt: now,
        })
        .where(inArray(archiveIngestJobs.id, ids))
        .returning({ id: archiveIngestJobs.id, stagingPath: archiveIngestJobs.stagingPath });

      return result;
    },

    async listJobsByOwner(ownerId: string, limit = 50): Promise<ArchiveIngestJob[]> {
      const rows = await db
        .select()
        .from(archiveIngestJobs)
        .where(eq(archiveIngestJobs.ownerId, ownerId))
        .orderBy(desc(archiveIngestJobs.createdAt))
        .limit(limit);

      return rows.map(mapArchiveIngestRowToJob);
    },

    async findQueuedJobs(limit: number): Promise<ArchiveIngestJob[]> {
      const rows = await db
        .select()
        .from(archiveIngestJobs)
        .where(eq(archiveIngestJobs.status, "queued"))
        .orderBy(archiveIngestJobs.createdAt)
        .limit(limit);

      return rows.map(mapArchiveIngestRowToJob);
    },

    async listActiveJobIds(): Promise<string[]> {
      const rows = await db
        .select({ id: archiveIngestJobs.id })
        .from(archiveIngestJobs)
        .where(inArray(archiveIngestJobs.status, [...ARCHIVE_INGEST_ACTIVE_STATUSES]));

      return rows.map((r) => r.id);
    },
  };
}
