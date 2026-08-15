DROP TABLE "videos" CASCADE;

CREATE TABLE "series" (
	"id" text PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"poster_url" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "series_source_url_unique" UNIQUE("source_url")
);

CREATE TABLE "episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"video_type" text,
	"video_url" text NOT NULL,
	"description" text,
	"duration" text,
	"tags" text[],
	"resolution" text,
	"format" text,
	"size" text,
	"metadata" jsonb,
	"series_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "episodes_source_url_unique" UNIQUE("source_url")
);

ALTER TABLE "episodes" ADD CONSTRAINT "episodes_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id");