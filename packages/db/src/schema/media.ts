import { integer, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

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
  order: integer("order").notNull().default(1),
  videoType: text("video_type"),
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

export const videoSources = pgTable(
  "video_sources",
  {
    id: text("id").primaryKey(),
    episodeId: text("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    url: text("url").notNull(),
    label: text("label").notNull(),
    quality: text("quality"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("video_sources_episode_id_url_unique").on(table.episodeId, table.url),
  ]
);

export type VideoSourceRow = typeof videoSources.$inferSelect;
export type NewVideoSourceRow = typeof videoSources.$inferInsert;