CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"video_type" text,
	"video_url" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "videos_source_url_unique" UNIQUE("source_url")
);
