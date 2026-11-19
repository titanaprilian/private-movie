import { describe, it, expect, vi, afterEach } from "vitest";
import { db } from "../../utils/db";
import { series, seasons, episodes, genres, seriesToGenres } from "@repo/db";
import {
  saveTmdbSeries,
  createMediaService,
  SeriesNotFoundError,
} from "../../../src";
import {
  setupTmdbFetchMock,
  FIXTURE_TMDB_TV_SHOW,
  FIXTURE_TMDB_TV_SEASON_1,
} from "../../fixtures/tmdb";

describe("TMDB Service (integration)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("saveTmdbSeries database upserts", () => {
    it("persists movie series with type='movie', 1 season and 1 episode inside transaction", async () => {
      const data = {
        tmdbId: 500,
        type: "movie" as const,
        title: "Inception",
        description: "Dream inside dream",
        posterPath: "https://image.tmdb.org/t/p/w500/inception.jpg",
        backdropPath: "https://image.tmdb.org/t/p/w500/inception_bg.jpg",
        firstAirDate: "2010-07-16",
        voteAverage: 8.8,
        genres: ["Action", "Sci-Fi"],
        seasons: [
          {
            seasonNumber: 1,
            name: "Inception",
            overview: "Dream inside dream",
            posterPath: "https://image.tmdb.org/t/p/w500/inception.jpg",
            airDate: "2010-07-16",
            episodes: [
              {
                id: 500,
                episode_number: 1,
                name: "Inception",
                overview: "Dream inside dream",
                runtime: 148,
                still_path: "/inception.jpg",
                vote_average: 8.8,
                air_date: "2010-07-16",
              },
            ],
          },
        ],
      };

      const result = await saveTmdbSeries(db, data);

      expect(result).toBeDefined();
      expect(result.title).toBe("Inception");
      expect(result.type).toBe("movie");
      expect(result.tmdbId).toBe(500);

      const dbSeries = await db.select().from(series);
      expect(dbSeries).toHaveLength(1);
      expect(dbSeries[0]?.title).toBe("Inception");
      expect(dbSeries[0]?.type).toBe("movie");

      const dbSeasons = await db.select().from(seasons);
      expect(dbSeasons).toHaveLength(1);
      expect(dbSeasons[0]?.seasonNumber).toBe(1);

      const dbEpisodes = await db.select().from(episodes);
      expect(dbEpisodes).toHaveLength(1);
      expect(dbEpisodes[0]?.order).toBe(1);
      expect(dbEpisodes[0]?.duration).toBe(148);

      const dbGenres = await db.select().from(genres);
      expect(dbGenres.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("createMediaService syncTmdb", () => {
    it("throws SeriesNotFoundError when target seriesId does not exist", async () => {
      const mediaService = createMediaService(db);

      await expect(
        mediaService.syncTmdb("non-existent-id", { type: "tv", tmdbId: 100 }),
      ).rejects.toThrow(SeriesNotFoundError);
    });

    it("updates series metadata, genres, upserts seasons and episodes in transaction", async () => {
      setupTmdbFetchMock();
      const now = new Date();
      const seriesId = "existing-series-id";

      await db.insert(series).values({
        id: seriesId,
        title: "Old Title",
        description: "Old Description",
        type: "tv",
        tmdbId: 100,
        tmdbSyncStatus: "PENDING",
        createdAt: now,
        updatedAt: now,
      });

      const mediaService = createMediaService(db);
      const synced = await mediaService.syncTmdb(seriesId, {
        type: "tv",
        tmdbId: 100,
      });

      expect(synced.id).toBe(seriesId);
      expect(synced.title).toBe(FIXTURE_TMDB_TV_SHOW.name);
      expect(synced.tmdbSyncStatus).toBe("SYNCED");

      const dbSeasons = await db.select().from(seasons);
      expect(dbSeasons.length).toBeGreaterThanOrEqual(1);

      const dbEpisodes = await db.select().from(episodes);
      expect(dbEpisodes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("createMediaService getTmdbSyncPreview", () => {
    it("throws SeriesNotFoundError when series does not exist", async () => {
      const mediaService = createMediaService(db);

      await expect(
        mediaService.getTmdbSyncPreview("non-existent-id", {
          type: "tv",
          tmdbId: 100,
        }),
      ).rejects.toThrow(SeriesNotFoundError);
    });

    it("calculates diffs, flags modified episode titles/overviews/thumbnails, and computes new episodes", async () => {
      setupTmdbFetchMock();
      const now = new Date();
      const seriesId = "series-diff-1";

      await db.insert(series).values({
        id: seriesId,
        title: "Local Title",
        description: "Old Local Description",
        type: "tv",
        posterUrl: "https://image.tmdb.org/t/p/w500/old_poster.jpg",
        backdropUrl: null,
        rating: "7.0",
        tmdbId: 100,
        tmdbSyncStatus: "SYNCED",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(seasons).values({
        id: "season-1",
        seriesId,
        seasonNumber: 1,
        title: "Season 1",
        description: "Season 1 desc",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(episodes).values({
        id: "ep-1",
        seasonId: "season-1",
        order: 1,
        title: "Old Episode Title",
        description: "Old Episode Overview",
        thumbnailUrl: "https://image.tmdb.org/t/p/w500/old_ep1.jpg",
        rating: "8.0",
        duration: 45,
        createdAt: now,
        updatedAt: now,
      });

      const mediaService = createMediaService(db);
      const preview = await mediaService.getTmdbSyncPreview(seriesId, {
        type: "tv",
        tmdbId: 100,
      });

      expect(preview).toBeDefined();
      expect(preview.seriesId).toBe(seriesId);
      expect(preview.seriesUpdated).toBe(true);
      expect(preview.series.title).toBe(FIXTURE_TMDB_TV_SHOW.name);
      expect(preview.totalNewEpisodes).toBeGreaterThanOrEqual(1);
      expect(preview.episodeChanges.length).toBeGreaterThanOrEqual(1);
      expect(preview.episodeChanges[0]).toEqual(
        expect.objectContaining({
          seasonNumber: 1,
          episodeNumber: 1,
          oldTitle: "Old Episode Title",
          newTitle: "Hello World",
          titleChanged: true,
        }),
      );
    });
  });
});
