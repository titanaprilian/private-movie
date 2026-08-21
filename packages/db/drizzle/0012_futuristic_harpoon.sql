CREATE TABLE "series_relations" (
	"from_series_id" text NOT NULL,
	"to_series_id" text NOT NULL,
	"relation_type" text NOT NULL,
	CONSTRAINT "series_relations_from_series_id_to_series_id_pk" PRIMARY KEY("from_series_id","to_series_id")
);
--> statement-breakpoint
ALTER TABLE "series_relations" ADD CONSTRAINT "series_relations_from_series_id_series_id_fk" FOREIGN KEY ("from_series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_relations" ADD CONSTRAINT "series_relations_to_series_id_series_id_fk" FOREIGN KEY ("to_series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;