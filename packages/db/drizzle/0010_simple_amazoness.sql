CREATE TABLE "video_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_id" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"label" text NOT NULL,
	"quality" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "video_sources_episode_id_url_unique" UNIQUE("episode_id","url")
);
--> statement-breakpoint
ALTER TABLE "video_sources" ADD CONSTRAINT "video_sources_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "embed_url";--> statement-breakpoint
ALTER TABLE "episodes" DROP COLUMN "video_url";