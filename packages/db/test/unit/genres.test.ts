import { describe, expect, it, vi } from "vitest";
import {
  extractGenresAndMappings,
  migrateGenres,
  parseGenresFromMetadata,
  slugifyGenre,
} from "../../src/migrate-genres";

describe("Genres Migration Unit Tests", () => {
  describe("slugifyGenre", () => {
    it("normalizes 'Sci-Fi & Fantasy' to 'sci-fi-and-fantasy'", () => {
      expect(slugifyGenre("Sci-Fi & Fantasy")).toBe("sci-fi-and-fantasy");
    });

    it("normalizes string with special characters and spaces correctly", () => {
      expect(slugifyGenre("Action & Adventure")).toBe("action-and-adventure");
      expect(slugifyGenre("Slice of Life")).toBe("slice-of-life");
      expect(slugifyGenre("  Comedy / Romance  ")).toBe("comedy-romance");
      expect(slugifyGenre("Boys' Love")).toBe("boys-love");
    });
  });

  describe("parseGenresFromMetadata", () => {
    it("extracts genre array from metadata object", () => {
      const metadata = { genres: ["Action", "Sci-Fi & Fantasy"] };
      expect(parseGenresFromMetadata(metadata)).toEqual(["Action", "Sci-Fi & Fantasy"]);
    });

    it("extracts single genre string from metadata object", () => {
      const metadata = { genres: "Drama" };
      expect(parseGenresFromMetadata(metadata)).toEqual(["Drama"]);
    });

    it("returns empty array for invalid or missing metadata", () => {
      expect(parseGenresFromMetadata(null)).toEqual([]);
      expect(parseGenresFromMetadata(undefined)).toEqual([]);
      expect(parseGenresFromMetadata("invalid")).toEqual([]);
      expect(parseGenresFromMetadata({})).toEqual([]);
      expect(parseGenresFromMetadata({ duration: "24 min" })).toEqual([]);
    });
  });

  describe("extractGenresAndMappings", () => {
    it("parses and extracts unique genres and mappings from mock episodes array", () => {
      const mockEpisodes = [
        {
          seriesId: "series-1",
          metadata: { genres: ["Sci-Fi & Fantasy", "Action"] },
        },
        {
          seriesId: "series-1",
          metadata: { genres: ["Action", "Drama"] },
        },
        {
          seriesId: "series-2",
          metadata: { genres: ["Sci-Fi & Fantasy", "Comedy"] },
        },
        {
          seriesId: null,
          metadata: { genres: ["Horror"] },
        },
      ];

      const { genresMap, seriesGenreMappings } = extractGenresAndMappings(mockEpisodes);

      // Verify unique genres in genresMap
      expect(genresMap.size).toBe(4);
      expect(genresMap.get("sci-fi-and-fantasy")).toEqual({
        id: expect.any(String),
        name: "Sci-Fi & Fantasy",
        slug: "sci-fi-and-fantasy",
      });
      expect(genresMap.get("action")).toEqual({
        id: expect.any(String),
        name: "Action",
        slug: "action",
      });
      expect(genresMap.get("drama")).toEqual({
        id: expect.any(String),
        name: "Drama",
        slug: "drama",
      });
      expect(genresMap.get("comedy")).toEqual({
        id: expect.any(String),
        name: "Comedy",
        slug: "comedy",
      });

      // Verify mappings for series-1 and series-2 without duplicates
      expect(seriesGenreMappings).toEqual([
        { seriesId: "series-1", genreSlug: "sci-fi-and-fantasy" },
        { seriesId: "series-1", genreSlug: "action" },
        { seriesId: "series-1", genreSlug: "drama" },
        { seriesId: "series-2", genreSlug: "sci-fi-and-fantasy" },
        { seriesId: "series-2", genreSlug: "comedy" },
      ]);
    });
  });

  describe("migrateGenres DB execution logic", () => {
    it("interacts with database to select episodes, insert genres, and insert seriesToGenres mappings", async () => {
      const mockEpisodesData = [
        {
          seriesId: "series-100",
          metadata: { genres: ["Sci-Fi & Fantasy", "Adventure"] },
        },
      ];

      const mockExistingGenres: Array<{ id: string; slug: string }> = [];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockImplementation(() => Promise.resolve(mockExistingGenres)),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockImplementation((opts) => {
              if (opts?.target) {
                // Genres insert
                mockExistingGenres.push(
                  { id: "genre-uuid-1", slug: "sci-fi-and-fantasy" },
                  { id: "genre-uuid-2", slug: "adventure" }
                );
              }
              return Promise.resolve();
            }),
          }),
        }),
      };

      const result = await migrateGenres(mockDb);

      expect(result.genresCount).toBe(0);
      expect(result.mappingsCount).toBe(0);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });
});
