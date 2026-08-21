import { integer, jsonb, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";

export const genres = pgTable("genres", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GenreRow = typeof genres.$inferSelect;
export type NewGenreRow = typeof genres.$inferInsert;

export const seriesToGenres = pgTable(
  "series_to_genres",
  {
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    genreId: text("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.seriesId, table.genreId] }),
  ]
);

export type SeriesToGenreRow = typeof seriesToGenres.$inferSelect;
export type NewSeriesToGenreRow = typeof seriesToGenres.$inferInsert;

export const series = pgTable("series", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull().unique(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  posterUrl: text("poster_url"),
  backdropUrl: text("backdrop_url"),
  rating: text("rating"),
  tmdbId: integer("tmdb_id"),
  tmdbSeason: integer("tmdb_season"),
  tmdbSyncStatus: text("tmdb_sync_status").notNull().default("PENDING"),
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