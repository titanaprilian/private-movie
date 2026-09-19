ALTER TABLE "genres" ADD COLUMN "is_big_genre" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "genres" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;