DROP TABLE "series_relations" CASCADE;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "backdrop_url" text;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "rating" text;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "tmdb_id" integer;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "tmdb_season" integer;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "tmdb_sync_status" text DEFAULT 'PENDING' NOT NULL;