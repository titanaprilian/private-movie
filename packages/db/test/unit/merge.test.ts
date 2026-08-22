import { describe, expect, it } from "vitest";
import { mapTmdbTvToSeriesRow, extractTmdbGenres, parseTmdbTvDetails } from "../../src/tmdb";
import type { TmdbTvDetails } from "../../src/tmdb/types";

const sampleTvDetails: TmdbTvDetails = {
  id: 30977,
  name: "A Certain Scientific Railgun",
  original_name: "とある科学の超電磁砲",
  overview: "Misaka's electro-manipulation skills make her a rock star in Academy City.",
  poster_path: "/dZt1dqw0K4JGhwcqTh8yExHYK9w.jpg",
  backdrop_path: "/cGgqLzBGUY0dxsE5i3W7SXBGRbe.jpg",
  vote_average: 8.2,
  genres: [
    { id: 16, name: "Animation" },
    { id: 10759, name: "Action & Adventure" },
    { id: 35, name: "Comedy" },
    { id: 10765, name: "Sci-Fi & Fantasy" },
  ],
  seasons: [],
};

describe("TMDB TV details mapper utilities", () => {
  describe("mapTmdbTvToSeriesRow", () => {
    it("maps raw TMDB TV details into a valid NewSeriesRow shape", () => {
      const now = new Date();
      const seriesRow = mapTmdbTvToSeriesRow(sampleTvDetails, {
        id: "series-123",
        createdAt: now,
        updatedAt: now,
      });

      expect(seriesRow).toEqual({
        id: "series-123",
        title: "A Certain Scientific Railgun",
        description: "Misaka's electro-manipulation skills make her a rock star in Academy City.",
        type: "tv",
        posterUrl: "/dZt1dqw0K4JGhwcqTh8yExHYK9w.jpg",
        backdropUrl: "/cGgqLzBGUY0dxsE5i3W7SXBGRbe.jpg",
        rating: "8.2",
        tmdbId: 30977,
        tmdbSyncStatus: "SYNCED",
        createdAt: now,
        updatedAt: now,
      });
    });

    it("handles missing optional poster_path, backdrop_path, overview, and vote_average gracefully", () => {
      const minimalDetails: TmdbTvDetails = {
        id: 9999,
        name: "Minimal Show",
        overview: "",
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
      };

      const now = new Date();
      const seriesRow = mapTmdbTvToSeriesRow(minimalDetails, {
        id: "series-min",
        createdAt: now,
        updatedAt: now,
      });

      expect(seriesRow.title).toBe("Minimal Show");
      expect(seriesRow.description).toBeNull();
      expect(seriesRow.posterUrl).toBeNull();
      expect(seriesRow.backdropUrl).toBeNull();
      expect(seriesRow.rating).toBe("0");
      expect(seriesRow.tmdbId).toBe(9999);
      expect(seriesRow.tmdbSyncStatus).toBe("SYNCED");
    });
  });

  describe("extractTmdbGenres", () => {
    it("extracts and formats genres for database insertion", () => {
      const genresList = extractTmdbGenres(sampleTvDetails);

      expect(genresList).toHaveLength(4);
      expect(genresList[0]).toMatchObject({
        name: "Animation",
        slug: "animation",
      });
      expect(genresList[1]).toMatchObject({
        name: "Action & Adventure",
        slug: "action-and-adventure",
      });
      expect(genresList[2]).toMatchObject({
        name: "Comedy",
        slug: "comedy",
      });
      expect(genresList[3]).toMatchObject({
        name: "Sci-Fi & Fantasy",
        slug: "sci-fi-and-fantasy",
      });

      for (const g of genresList) {
        expect(g.id).toBeDefined();
        expect(typeof g.id).toBe("string");
      }
    });

    it("returns an empty array if genres are missing or empty", () => {
      const detailsNoGenres: TmdbTvDetails = {
        id: 111,
        name: "No Genre Show",
        overview: "No genres",
        poster_path: null,
        backdrop_path: null,
        vote_average: 5,
      };

      expect(extractTmdbGenres(detailsNoGenres)).toEqual([]);
    });
  });

  describe("parseTmdbTvDetails", () => {
    it("returns both series row and extracted genres", () => {
      const now = new Date();
      const result = parseTmdbTvDetails(sampleTvDetails, {
        id: "series-combined",
        createdAt: now,
        updatedAt: now,
      });

      expect(result.series.id).toBe("series-combined");
      expect(result.series.title).toBe("A Certain Scientific Railgun");
      expect(result.genres).toHaveLength(4);
    });
  });
});
