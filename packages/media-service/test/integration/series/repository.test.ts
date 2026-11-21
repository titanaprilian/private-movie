import { describe, expect, it } from "vitest";
import { db } from "../../utils/db";
import { series, seasons, genres, seriesToGenres } from "@repo/db";
import {
  createSeriesRepositoryInternal,
  SeriesHighlightWithoutOngoingError,
} from "../../../src/internal/series/repository";

describe("series repository (integration)", () => {
  const repository = createSeriesRepositoryInternal(db);

  describe("findByIdWithEpisodes season sorting", () => {
    it("returns seasons strictly ordered by seasonNumber priority [1, 3, 0, null]", async () => {
      const now = new Date();
      const seriesId = "series-sort-test";

      await db.insert(series).values({
        id: seriesId,
        title: "Test Sort Series",
        type: "tv",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(seasons).values([
        {
          id: "s3",
          seriesId,
          title: "Season 3",
          seasonNumber: 3,
          createdAt: new Date("2026-01-01"),
          updatedAt: now,
        },
        {
          id: "s1",
          seriesId,
          title: "Season 1",
          seasonNumber: 1,
          createdAt: new Date("2026-01-02"),
          updatedAt: now,
        },
        {
          id: "s0",
          seriesId,
          title: "Specials",
          seasonNumber: 0,
          createdAt: new Date("2026-01-03"),
          updatedAt: now,
        },
        {
          id: "sNull",
          seriesId,
          title: "Season Null",
          seasonNumber: null,
          createdAt: new Date("2026-01-04"),
          updatedAt: now,
        },
      ]);

      const result = await repository.findByIdWithEpisodes(seriesId);

      expect(result).not.toBeNull();
      expect(result?.seasons).toHaveLength(4);
      expect(result?.seasons.map((s) => s.seasonNumber)).toEqual([
        1,
        3,
        0,
        null,
      ]);
      expect(result?.seasons.map((s) => s.id)).toEqual([
        "s1",
        "s3",
        "s0",
        "sNull",
      ]);
    });
  });

  describe("series repository list filtering", () => {
    it("filters series by multiple genre slugs using AND logic", async () => {
      const now = new Date();

      await db.insert(genres).values([
        {
          id: "g-action",
          name: "Action",
          slug: "action",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "g-comedy",
          name: "Comedy",
          slug: "comedy",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "g-drama",
          name: "Drama",
          slug: "drama",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await db.insert(series).values([
        {
          id: "s-both",
          title: "Action and Comedy",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "s-action-only",
          title: "Action Only",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await db.insert(seriesToGenres).values([
        { seriesId: "s-both", genreId: "g-action" },
        { seriesId: "s-both", genreId: "g-comedy" },
        { seriesId: "s-action-only", genreId: "g-action" },
      ]);

      const matchBoth = await repository.list({
        page: 1,
        limit: 10,
        genre: "action, comedy",
      });
      expect(matchBoth.total).toBe(1);
      expect(matchBoth.series[0]?.id).toBe("s-both");

      const matchDrama = await repository.list({
        page: 1,
        limit: 10,
        genre: "drama",
      });
      expect(matchDrama.total).toBe(0);
      expect(matchDrama.series).toEqual([]);
    });

    it("supports filter=featured and filter=ongoing parameters", async () => {
      const now = new Date();

      await db.insert(series).values([
        {
          id: "s-feat",
          title: "Featured Series",
          isFeatured: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "s-ongoing",
          title: "Ongoing Series",
          isFeatured: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "s-neither",
          title: "Regular Series",
          isFeatured: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await db.insert(seasons).values([
        {
          id: "sea-ongoing",
          seriesId: "s-ongoing",
          title: "Ongoing Season",
          status: "ongoing",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "sea-completed",
          seriesId: "s-neither",
          title: "Completed Season",
          status: "completed",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const featuredList = await repository.list({
        page: 1,
        limit: 10,
        filter: "featured",
      });
      expect(featuredList.series.map((s) => s.id)).toContain("s-feat");
      expect(featuredList.series.map((s) => s.id)).not.toContain("s-ongoing");
      expect(featuredList.series.map((s) => s.id)).not.toContain("s-neither");

      const ongoingList = await repository.list({
        page: 1,
        limit: 10,
        filter: "ongoing",
      });
      expect(ongoingList.series.map((s) => s.id)).toContain("s-ongoing");
      expect(ongoingList.series.map((s) => s.id)).not.toContain("s-neither");
    });
  });

  describe("series repository updateSeries", () => {
    it("updates logoUrl and returns updated series with logoUrl", async () => {
      const now = new Date();
      const seriesId = "series-update-test";

      await db.insert(series).values({
        id: seriesId,
        title: "Original Title",
        createdAt: now,
        updatedAt: now,
      });

      const updated = await repository.updateSeries(seriesId, {
        logoUrl: "https://example.com/logo.png",
      });

      expect(updated.logoUrl).toBe("https://example.com/logo.png");

      const fetched = await repository.findById(seriesId);
      expect(fetched?.logoUrl).toBe("https://example.com/logo.png");
    });

    it("rejects highlighting a series with no ongoing seasons", async () => {
      const now = new Date();
      const seriesId = "series-highlight-guard";

      await db.insert(series).values({
        id: seriesId,
        title: "Non-Ongoing Series",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        repository.updateSeries(seriesId, { isOngoingHighlighted: true }),
      ).rejects.toThrow(SeriesHighlightWithoutOngoingError);
    });
  });

  describe("getHomeFeed", () => {
    it("returns structured home feed payload including hero, rows and recently added episodes", async () => {
      const feed = await repository.getHomeFeed();
      expect(feed).toHaveProperty("hero");
      expect(feed).toHaveProperty("heroes");
      expect(feed).toHaveProperty("rows");
      expect(feed).toHaveProperty("recentlyAddedEpisodes");
      expect(Array.isArray(feed.heroes)).toBe(true);
      expect(Array.isArray(feed.rows)).toBe(true);
      expect(Array.isArray(feed.recentlyAddedEpisodes)).toBe(true);
    });
  });
});
