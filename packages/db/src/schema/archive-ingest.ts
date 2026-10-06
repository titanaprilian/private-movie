import { sql } from "drizzle-orm";
import {
  bigint,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { series } from "./media";

export type ArchiveIngestJobEntryRow = {
  filename: string;
  sizeBytes: number | null;
  detectedEpisodeNumber?: number | null;
  quality?: string | null;
  needsReview?: boolean;
};

export type ArchiveIngestJobSelectionRow = {
  filename: string;
  episodeId: string | null;
  label?: string | null;
  quality?: string | null;
  isIgnored?: boolean;
  completed?: boolean;
  videoSourceId?: string | null;
};

export const archiveIngestJobs = pgTable(
  "archive_ingest_jobs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seriesId: text("series_id").references(() => series.id, {
      onDelete: "set null",
    }),
    sourceKey: text("source_key").notNull(),
    sourceUrl: text("source_url").notNull(),
    status: text("status").notNull(),
    stage: text("stage").notNull(),
    bytesDone: bigint("bytes_done", { mode: "number" }).notNull().default(0),
    bytesTotal: bigint("bytes_total", { mode: "number" }),
    stagingPath: text("staging_path"),
    archiveFilename: text("archive_filename"),
    entries: jsonb("entries")
      .$type<ArchiveIngestJobEntryRow[]>()
      .notNull()
      .default([]),
    selection: jsonb("selection")
      .$type<ArchiveIngestJobSelectionRow[]>()
      .notNull()
      .default([]),
    storageProviderId: text("storage_provider_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("archive_ingest_jobs_owner_source_active_unique")
      .on(table.ownerId, table.sourceKey)
      .where(
        sql`${table.status} IN ('queued', 'downloading', 'listing', 'ready', 'uploading')`,
      ),
  ],
);

export type ArchiveIngestJobRow = typeof archiveIngestJobs.$inferSelect;
export type NewArchiveIngestJobRow = typeof archiveIngestJobs.$inferInsert;
