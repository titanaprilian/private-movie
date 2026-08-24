ALTER TABLE "episodes" DROP CONSTRAINT "episodes_source_url_unique";--> statement-breakpoint
ALTER TABLE "episodes" ALTER COLUMN "duration" SET DATA TYPE integer USING NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "tmdb_id" integer;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "rating" text;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "air_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "source_url";--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_tmdb_id_unique" UNIQUE("tmdb_id");--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_order_unique" UNIQUE("season_id","order");
