CREATE TABLE "storage_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider_type" text NOT NULL,
	"endpoint" text NOT NULL,
	"region" text NOT NULL,
	"bucket" text NOT NULL,
	"access_key_id_enc" text NOT NULL,
	"secret_access_key_enc" text NOT NULL,
	"public_base_url" text,
	"force_path_style" boolean DEFAULT false NOT NULL,
	"storage_limit_gb" integer DEFAULT 50 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_sources" ADD COLUMN "storage_provider_id" text;--> statement-breakpoint
ALTER TABLE "video_sources" ADD CONSTRAINT "video_sources_storage_provider_id_storage_providers_id_fk" FOREIGN KEY ("storage_provider_id") REFERENCES "public"."storage_providers"("id") ON DELETE restrict ON UPDATE no action;