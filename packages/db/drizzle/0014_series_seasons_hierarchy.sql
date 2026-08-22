ALTER TABLE "series" RENAME TO "seasons";--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "series_id" text;--> statement-breakpoint
CREATE TABLE "series" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'tv' NOT NULL,
	"poster_url" text,
	"backdrop_url" text,
	"rating" text,
	"tmdb_id" integer,
	"tmdb_sync_status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);--> statement-breakpoint
INSERT INTO "series" ("id", "title", "description", "type", "poster_url", "backdrop_url", "rating", "tmdb_id", "tmdb_sync_status", "created_at", "updated_at")
SELECT
  id,
  title,
  description,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM episodes WHERE episodes.series_id = seasons.id AND LOWER(episodes.video_type) = 'movie'
    ) OR LOWER(title) LIKE '%movie%' THEN 'movie'
    ELSE 'tv'
  END AS type,
  poster_url,
  backdrop_url,
  rating,
  tmdb_id,
  tmdb_sync_status,
  created_at,
  updated_at
FROM "seasons";--> statement-breakpoint
UPDATE "seasons" SET "series_id" = "id";--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "series_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" RENAME COLUMN "series_id" TO "season_id";--> statement-breakpoint
ALTER TABLE "episodes" DROP CONSTRAINT IF EXISTS "episodes_series_id_series_id_fk";--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_to_genres" DROP CONSTRAINT IF EXISTS "series_to_genres_series_id_series_id_fk";--> statement-breakpoint
ALTER TABLE "series_to_genres" ADD CONSTRAINT "series_to_genres_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;
