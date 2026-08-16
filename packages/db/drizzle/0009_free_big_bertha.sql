ALTER TABLE "episodes" ALTER COLUMN "video_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "embed_url" text;