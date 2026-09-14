ALTER TABLE "seasons" ADD COLUMN "scraper_url" text;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "episode_offset" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "last_scraped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "last_scrape_error" text;