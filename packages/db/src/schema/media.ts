import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const series = pgTable("series", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull().unique(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  posterUrl: text("poster_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type SeriesRow = typeof series.$inferSelect;
export type NewSeriesRow = typeof series.$inferInsert;

export const episodes = pgTable("episodes", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull().unique(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  videoType: text("video_type"),
  videoUrl: text("video_url").notNull(),
  description: text("description"),
  duration: text("duration"),
  tags: text("tags").array(),
  resolution: text("resolution"),
  format: text("format"),
  size: text("size"),
  metadata: jsonb("metadata"),
  seriesId: text("series_id").references(() => series.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type EpisodeRow = typeof episodes.$inferSelect;
export type NewEpisodeRow = typeof episodes.$inferInsert;