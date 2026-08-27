ALTER TABLE "seasons" RENAME COLUMN "tmdb_season" TO "season_number";--> statement-breakpoint
ALTER TABLE "seasons" DROP CONSTRAINT IF EXISTS "seasons_source_url_unique";--> statement-breakpoint
ALTER TABLE "seasons" DROP CONSTRAINT IF EXISTS "series_source_url_unique";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN IF EXISTS "source_url";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN IF EXISTS "source";--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_series_id_season_number_unique" UNIQUE("series_id","season_number");--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_tmdb_id_unique" UNIQUE("tmdb_id");