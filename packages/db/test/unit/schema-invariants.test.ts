import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../../src/schema";

describe("schema invariants", () => {
  describe("foreign keys & referential actions", () => {
    it("seriesToGenres enforces cascade on delete for both series and genre references", () => {
      const config = getTableConfig(schema.seriesToGenres);
      const fks = config.foreignKeys.map((fk) => ({
        columns: fk.reference().columns.map((c) => c.name),
        foreignTable: fk.reference().foreignTable[Symbol.for("drizzle:Name")],
        foreignColumns: fk.reference().foreignColumns.map((c) => c.name),
        onDelete: fk.onDelete,
      }));

      expect(fks).toHaveLength(2);

      const seriesFk = fks.find((fk) => fk.foreignTable === "series");
      expect(seriesFk).toBeDefined();
      expect(seriesFk?.columns).toEqual(["series_id"]);
      expect(seriesFk?.foreignColumns).toEqual(["id"]);
      expect(seriesFk?.onDelete).toBe("cascade");

      const genreFk = fks.find((fk) => fk.foreignTable === "genres");
      expect(genreFk).toBeDefined();
      expect(genreFk?.columns).toEqual(["genre_id"]);
      expect(genreFk?.foreignColumns).toEqual(["id"]);
      expect(genreFk?.onDelete).toBe("cascade");
    });

    it("seasons cascades on series delete", () => {
      const config = getTableConfig(schema.seasons);
      const fks = config.foreignKeys.map((fk) => ({
        columns: fk.reference().columns.map((c) => c.name),
        foreignTable: fk.reference().foreignTable[Symbol.for("drizzle:Name")],
        onDelete: fk.onDelete,
      }));

      const seriesFk = fks.find((fk) => fk.foreignTable === "series");
      expect(seriesFk).toBeDefined();
      expect(seriesFk?.columns).toEqual(["series_id"]);
      expect(seriesFk?.onDelete).toBe("cascade");
    });

    it("episodes references seasons with default onDelete (no action)", () => {
      const config = getTableConfig(schema.episodes);
      const fks = config.foreignKeys.map((fk) => ({
        columns: fk.reference().columns.map((c) => c.name),
        foreignTable: fk.reference().foreignTable[Symbol.for("drizzle:Name")],
        onDelete: fk.onDelete,
      }));

      const seasonFk = fks.find((fk) => fk.foreignTable === "seasons");
      expect(seasonFk).toBeDefined();
      expect(seasonFk?.columns).toEqual(["season_id"]);
      expect(seasonFk?.onDelete).toBe("no action");
    });

    it("videoSources cascades on episode delete and restricts on storage provider delete", () => {
      const config = getTableConfig(schema.videoSources);
      const fks = config.foreignKeys.map((fk) => ({
        columns: fk.reference().columns.map((c) => c.name),
        foreignTable: fk.reference().foreignTable[Symbol.for("drizzle:Name")],
        onDelete: fk.onDelete,
      }));

      expect(fks).toHaveLength(2);

      const episodeFk = fks.find((fk) => fk.foreignTable === "episodes");
      expect(episodeFk).toBeDefined();
      expect(episodeFk?.columns).toEqual(["episode_id"]);
      expect(episodeFk?.onDelete).toBe("cascade");

      const storageFk = fks.find(
        (fk) => fk.foreignTable === "storage_providers",
      );
      expect(storageFk).toBeDefined();
      expect(storageFk?.columns).toEqual(["storage_provider_id"]);
      expect(storageFk?.onDelete).toBe("restrict");
    });

    it("archiveIngestJobs cascades on user delete and sets null on series delete", () => {
      const config = getTableConfig(schema.archiveIngestJobs);
      const fks = config.foreignKeys.map((fk) => ({
        columns: fk.reference().columns.map((c) => c.name),
        foreignTable: fk.reference().foreignTable[Symbol.for("drizzle:Name")],
        onDelete: fk.onDelete,
      }));

      const ownerFk = fks.find((fk) => fk.foreignTable === "users");
      expect(ownerFk).toBeDefined();
      expect(ownerFk?.columns).toEqual(["owner_id"]);
      expect(ownerFk?.onDelete).toBe("cascade");

      const seriesFk = fks.find((fk) => fk.foreignTable === "series");
      expect(seriesFk).toBeDefined();
      expect(seriesFk?.columns).toEqual(["series_id"]);
      expect(seriesFk?.onDelete).toBe("set null");
    });

    it("refreshTokens references users", () => {
      const config = getTableConfig(schema.refreshTokens);
      const fks = config.foreignKeys.map((fk) => ({
        columns: fk.reference().columns.map((c) => c.name),
        foreignTable: fk.reference().foreignTable[Symbol.for("drizzle:Name")],
        onDelete: fk.onDelete,
      }));

      const userFk = fks.find((fk) => fk.foreignTable === "users");
      expect(userFk).toBeDefined();
      expect(userFk?.columns).toEqual(["user_id"]);
    });
  });

  describe("unique constraints & indexes", () => {
    it("enforces column-level unique constraints", () => {
      const usersConfig = getTableConfig(schema.users);
      const emailCol = usersConfig.columns.find((c) => c.name === "email");
      expect(emailCol?.isUnique).toBe(true);

      const refreshTokensConfig = getTableConfig(schema.refreshTokens);
      const tokenCol = refreshTokensConfig.columns.find(
        (c) => c.name === "token",
      );
      expect(tokenCol?.isUnique).toBe(true);

      const systemConfig = getTableConfig(schema.system);
      const keyCol = systemConfig.columns.find((c) => c.name === "key");
      expect(keyCol?.isUnique).toBe(true);

      const genresConfig = getTableConfig(schema.genres);
      const nameCol = genresConfig.columns.find((c) => c.name === "name");
      const slugCol = genresConfig.columns.find((c) => c.name === "slug");
      expect(nameCol?.isUnique).toBe(true);
      expect(slugCol?.isUnique).toBe(true);

      const seriesConfig = getTableConfig(schema.series);
      const tmdbIdCol = seriesConfig.columns.find((c) => c.name === "tmdb_id");
      expect(tmdbIdCol?.isUnique).toBe(true);
    });

    it("enforces table-level composite unique constraints", () => {
      const seasonsConfig = getTableConfig(schema.seasons);
      const seasonsUnique = seasonsConfig.uniqueConstraints.find(
        (u) => u.getName() === "seasons_series_id_season_number_unique",
      );
      expect(seasonsUnique).toBeDefined();
      expect(seasonsUnique?.columns.map((c) => c.name)).toEqual([
        "series_id",
        "season_number",
      ]);

      const episodesConfig = getTableConfig(schema.episodes);
      const episodesUnique = episodesConfig.uniqueConstraints.find(
        (u) => u.getName() === "episodes_season_id_order_unique",
      );
      expect(episodesUnique).toBeDefined();
      expect(episodesUnique?.columns.map((c) => c.name)).toEqual([
        "season_id",
        "order",
      ]);

      const videoSourcesConfig = getTableConfig(schema.videoSources);
      const videoSourcesUnique = videoSourcesConfig.uniqueConstraints.find(
        (u) => u.getName() === "video_sources_episode_id_url_unique",
      );
      expect(videoSourcesUnique).toBeDefined();
      expect(videoSourcesUnique?.columns.map((c) => c.name)).toEqual([
        "episode_id",
        "url",
      ]);
    });

    it("enforces composite primary key on seriesToGenres", () => {
      const config = getTableConfig(schema.seriesToGenres);
      expect(config.primaryKeys).toHaveLength(1);
      const pk = config.primaryKeys[0];
      expect(pk?.columns.map((c) => c.name)).toEqual(["series_id", "genre_id"]);
    });

    it("enforces unique partial index on active archiveIngestJobs", () => {
      const config = getTableConfig(schema.archiveIngestJobs);
      const index = config.indexes.find(
        (i) =>
          i.config.name === "archive_ingest_jobs_owner_source_active_unique",
      );
      expect(index).toBeDefined();
      expect(index?.config.unique).toBe(true);
      expect(index?.config.columns.map((c) => c.name)).toEqual([
        "owner_id",
        "source_key",
      ]);
      expect(index?.config.where).toBeDefined();
    });
  });

  describe("not-null column constraints & defaults", () => {
    it("users table has correct not-nulls and defaults", () => {
      const config = getTableConfig(schema.users);
      const colMap = new Map(config.columns.map((c) => [c.name, c]));

      expect(colMap.get("id")?.notNull).toBe(true);
      expect(colMap.get("name")?.notNull).toBe(true);
      expect(colMap.get("email")?.notNull).toBe(true);
      expect(colMap.get("password_hash")?.notNull).toBe(true);
      expect(colMap.get("created_at")?.notNull).toBe(true);
      expect(colMap.get("failed_attempts")?.notNull).toBe(true);
      expect(colMap.get("failed_attempts")?.default).toBe(0);

      expect(colMap.get("locked_until")?.notNull).toBe(false);
      expect(colMap.get("sessions_valid_after")?.notNull).toBe(false);
    });

    it("refreshTokens table has correct not-nulls and defaults", () => {
      const config = getTableConfig(schema.refreshTokens);
      const colMap = new Map(config.columns.map((c) => [c.name, c]));

      expect(colMap.get("id")?.notNull).toBe(true);
      expect(colMap.get("token")?.notNull).toBe(true);
      expect(colMap.get("user_id")?.notNull).toBe(true);
      expect(colMap.get("expires_at")?.notNull).toBe(true);
      expect(colMap.get("revoked")?.notNull).toBe(true);
      expect(colMap.get("revoked")?.default).toBe(false);
      expect(colMap.get("created_at")?.notNull).toBe(true);

      expect(colMap.get("device_info")?.notNull).toBe(false);
      expect(colMap.get("revoked_at")?.notNull).toBe(false);
    });

    it("system table has correct not-nulls", () => {
      const config = getTableConfig(schema.system);
      const colMap = new Map(config.columns.map((c) => [c.name, c]));

      expect(colMap.get("id")?.notNull).toBe(true);
      expect(colMap.get("key")?.notNull).toBe(true);
      expect(colMap.get("value")?.notNull).toBe(true);
      expect(colMap.get("created_at")?.notNull).toBe(true);
    });

    it("storageProviders table has correct not-nulls and defaults", () => {
      const config = getTableConfig(schema.storageProviders);
      const colMap = new Map(config.columns.map((c) => [c.name, c]));

      expect(colMap.get("id")?.notNull).toBe(true);
      expect(colMap.get("name")?.notNull).toBe(true);
      expect(colMap.get("provider_type")?.notNull).toBe(true);
      expect(colMap.get("endpoint")?.notNull).toBe(true);
      expect(colMap.get("region")?.notNull).toBe(true);
      expect(colMap.get("bucket")?.notNull).toBe(true);
      expect(colMap.get("access_key_id_enc")?.notNull).toBe(true);
      expect(colMap.get("secret_access_key_enc")?.notNull).toBe(true);
      expect(colMap.get("force_path_style")?.notNull).toBe(true);
      expect(colMap.get("force_path_style")?.default).toBe(false);
      expect(colMap.get("storage_limit_gb")?.notNull).toBe(true);
      expect(colMap.get("storage_limit_gb")?.default).toBe(50);
      expect(colMap.get("is_default")?.notNull).toBe(true);
      expect(colMap.get("is_default")?.default).toBe(false);
      expect(colMap.get("is_enabled")?.notNull).toBe(true);
      expect(colMap.get("is_enabled")?.default).toBe(true);
      expect(colMap.get("created_at")?.notNull).toBe(true);
      expect(colMap.get("updated_at")?.notNull).toBe(true);

      expect(colMap.get("public_base_url")?.notNull).toBe(false);
    });

    it("genres table has correct not-nulls and defaults", () => {
      const config = getTableConfig(schema.genres);
      const colMap = new Map(config.columns.map((c) => [c.name, c]));

      expect(colMap.get("id")?.notNull).toBe(true);
      expect(colMap.get("name")?.notNull).toBe(true);
      expect(colMap.get("slug")?.notNull).toBe(true);
      expect(colMap.get("is_big_genre")?.notNull).toBe(true);
      expect(colMap.get("is_big_genre")?.default).toBe(false);
      expect(colMap.get("display_order")?.notNull).toBe(true);
      expect(colMap.get("display_order")?.default).toBe(0);
      expect(colMap.get("created_at")?.notNull).toBe(true);
      expect(colMap.get("updated_at")?.notNull).toBe(true);
    });

    it("series table has correct not-nulls and defaults", () => {
      const config = getTableConfig(schema.series);
      const colMap = new Map(config.columns.map((c) => [c.name, c]));

      expect(colMap.get("id")?.notNull).toBe(true);
      expect(colMap.get("title")?.notNull).toBe(true);
      expect(colMap.get("type")?.notNull).toBe(true);
      expect(colMap.get("type")?.default).toBe("tv");
      expect(colMap.get("tmdb_sync_status")?.notNull).toBe(true);
      expect(colMap.get("tmdb_sync_status")?.default).toBe("PENDING");
      expect(colMap.get("is_featured")?.notNull).toBe(true);
      expect(colMap.get("is_featured")?.default).toBe(false);
      expect(colMap.get("is_ongoing_highlighted")?.notNull).toBe(true);
      expect(colMap.get("is_ongoing_highlighted")?.default).toBe(false);
      expect(colMap.get("created_at")?.notNull).toBe(true);
      expect(colMap.get("updated_at")?.notNull).toBe(true);

      expect(colMap.get("description")?.notNull).toBe(false);
      expect(colMap.get("poster_url")?.notNull).toBe(false);
      expect(colMap.get("backdrop_url")?.notNull).toBe(false);
      expect(colMap.get("logo_url")?.notNull).toBe(false);
      expect(colMap.get("rating")?.notNull).toBe(false);
      expect(colMap.get("tmdb_id")?.notNull).toBe(false);
    });

    it("seasons table has correct not-nulls and defaults", () => {
      const config = getTableConfig(schema.seasons);
      const colMap = new Map(config.columns.map((c) => [c.name, c]));

      expect(colMap.get("id")?.notNull).toBe(true);
      expect(colMap.get("series_id")?.notNull).toBe(true);
      expect(colMap.get("title")?.notNull).toBe(true);
      expect(colMap.get("status")?.notNull).toBe(true);
      expect(colMap.get("status")?.default).toBe("completed");
      expect(colMap.get("episode_offset")?.notNull).toBe(true);
      expect(colMap.get("episode_offset")?.default).toBe(0);
      expect(colMap.get("tmdb_sync_status")?.notNull).toBe(true);
      expect(colMap.get("tmdb_sync_status")?.default).toBe("PENDING");
      expect(colMap.get("created_at")?.notNull).toBe(true);
      expect(colMap.get("updated_at")?.notNull).toBe(true);

      expect(colMap.get("season_number")?.notNull).toBe(false);
      expect(colMap.get("scraper_url")?.notNull).toBe(false);
      expect(colMap.get("source")?.notNull).toBe(false);
      expect(colMap.get("last_scraped_at")?.notNull).toBe(false);
      expect(colMap.get("last_scrape_error")?.notNull).toBe(false);
    });

    it("episodes table has correct not-nulls and defaults", () => {
      const config = getTableConfig(schema.episodes);
      const colMap = new Map(config.columns.map((c) => [c.name, c]));

      expect(colMap.get("id")?.notNull).toBe(true);
      expect(colMap.get("title")?.notNull).toBe(true);
      expect(colMap.get("order")?.notNull).toBe(true);
      expect(colMap.get("order")?.default).toBe(1);
      expect(colMap.get("season_id")?.notNull).toBe(true);
      expect(colMap.get("is_unassigned")?.notNull).toBe(true);
      expect(colMap.get("is_unassigned")?.default).toBe(false);
      expect(colMap.get("created_at")?.notNull).toBe(true);
      expect(colMap.get("updated_at")?.notNull).toBe(true);

      expect(colMap.get("description")?.notNull).toBe(false);
      expect(colMap.get("duration")?.notNull).toBe(false);
      expect(colMap.get("thumbnail_url")?.notNull).toBe(false);
      expect(colMap.get("rating")?.notNull).toBe(false);
      expect(colMap.get("air_date")?.notNull).toBe(false);
      expect(colMap.get("tmdb_season_number")?.notNull).toBe(false);
      expect(colMap.get("tmdb_episode_number")?.notNull).toBe(false);
    });

    it("videoSources table has correct not-nulls", () => {
      const config = getTableConfig(schema.videoSources);
      const colMap = new Map(config.columns.map((c) => [c.name, c]));

      expect(colMap.get("id")?.notNull).toBe(true);
      expect(colMap.get("episode_id")?.notNull).toBe(true);
      expect(colMap.get("type")?.notNull).toBe(true);
      expect(colMap.get("url")?.notNull).toBe(true);
      expect(colMap.get("label")?.notNull).toBe(true);
      expect(colMap.get("created_at")?.notNull).toBe(true);
      expect(colMap.get("updated_at")?.notNull).toBe(true);

      expect(colMap.get("quality")?.notNull).toBe(false);
      expect(colMap.get("storage_provider_id")?.notNull).toBe(false);
    });
  });
});
