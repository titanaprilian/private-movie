CREATE TABLE "archive_ingest_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"series_id" text,
	"source_key" text NOT NULL,
	"source_url" text NOT NULL,
	"status" text NOT NULL,
	"stage" text NOT NULL,
	"bytes_done" bigint DEFAULT 0 NOT NULL,
	"bytes_total" bigint,
	"staging_path" text,
	"archive_filename" text,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selection" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"storage_provider_id" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "archive_ingest_jobs" ADD CONSTRAINT "archive_ingest_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_ingest_jobs" ADD CONSTRAINT "archive_ingest_jobs_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "archive_ingest_jobs_owner_source_active_unique" ON "archive_ingest_jobs" USING btree ("owner_id","source_key") WHERE "archive_ingest_jobs"."status" IN ('queued', 'downloading', 'listing', 'ready', 'uploading');