import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const videos = pgTable("videos", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull().unique(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  videoType: text("video_type"),
  videoUrl: text("video_url").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type VideoRow = typeof videos.$inferSelect;
export type NewVideoRow = typeof videos.$inferInsert;
