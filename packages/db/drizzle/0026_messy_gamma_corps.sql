ALTER TABLE "episodes" ADD COLUMN "tmdb_season_number" integer;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "tmdb_episode_number" integer;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "is_unassigned" boolean DEFAULT false NOT NULL;