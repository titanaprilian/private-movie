CREATE INDEX "episodes_season_id_idx" ON "episodes" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "seasons_series_id_idx" ON "seasons" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "seasons_status_idx" ON "seasons" USING btree ("status");