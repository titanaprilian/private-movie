ALTER TABLE "series" ADD COLUMN "status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;