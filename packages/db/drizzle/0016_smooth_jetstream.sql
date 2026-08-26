ALTER TABLE "episodes" DROP CONSTRAINT "episodes_tmdb_id_unique";--> statement-breakpoint
ALTER TABLE "episodes" ALTER COLUMN "season_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "video_type";--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "resolution";--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "format";--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "size";--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "tmdb_id";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "backdrop_url";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "rating";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "tmdb_id";