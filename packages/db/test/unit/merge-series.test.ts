import { describe, expect, it, vi } from "vitest";
import {
  createMergePlanForTmdbId,
  groupSeasonsByTmdbId,
  mergeSeries,
  type SeasonInput,
} from "../../src/merge-series";
import type { TmdbTvDetails } from "../../src/tmdb/types";

const mockTvDetails: TmdbTvDetails = {
  id: 100,
  name: "Test Series Name",
  overview: "Test series overview",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  vote_average: 8.5,
  genres: [
    { id: 1, name: "Action" },
    { id: 2, name: "Sci-Fi" },
  ],
};

describe("Merge Series Logic", () => {
  describe("groupSeasonsByTmdbId", () => {
    it("groups seasons by tmdbId, selecting the first seriesId as canonical and others as duplicates", () => {
      const seasonsInput: SeasonInput[] = [
        { id: "season-1", seriesId: "series-a", tmdbId: 100, title: "Season 1" },
        { id: "season-2", seriesId: "series-b", tmdbId: 100, title: "Season 2" },
        { id: "season-3", seriesId: "series-c", tmdbId: 100, title: "Season 3" },
        { id: "season-4", seriesId: "series-d", tmdbId: 200, title: "Other Season 1" },
        { id: "season-5", seriesId: "series-d", tmdbId: 200, title: "Other Season 2" },
        { id: "season-6", seriesId: "series-e", tmdbId: null, title: "Unmatched Season" },
      ];

      const groups = groupSeasonsByTmdbId(seasonsInput);

      expect(groups.size).toBe(2);

      const group100 = groups.get(100);
      expect(group100).toBeDefined();
      expect(group100?.canonicalSeriesId).toBe("series-a");
      expect(group100?.duplicateSeriesIds).toEqual(["series-b", "series-c"]);
      expect(group100?.seasonIds).toEqual(["season-1", "season-2", "season-3"]);

      const group200 = groups.get(200);
      expect(group200).toBeDefined();
      expect(group200?.canonicalSeriesId).toBe("series-d");
      expect(group200?.duplicateSeriesIds).toEqual([]);
      expect(group200?.seasonIds).toEqual(["season-4", "season-5"]);
    });
  });

  describe("createMergePlanForTmdbId", () => {
    it("creates a merge plan mapping canonical series ID and extracted genres", () => {
      const group = {
        tmdbId: 100,
        canonicalSeriesId: "series-a",
        duplicateSeriesIds: ["series-b"],
        seasonIds: ["season-1", "season-2"],
        seasons: [
          { id: "season-1", seriesId: "series-a", tmdbId: 100, title: "Season 1" },
          { id: "season-2", seriesId: "series-b", tmdbId: 100, title: "Season 2" },
        ],
      };

      const plan = createMergePlanForTmdbId(mockTvDetails, group);

      expect(plan.tmdbId).toBe(100);
      expect(plan.canonicalSeriesId).toBe("series-a");
      expect(plan.duplicateSeriesIds).toEqual(["series-b"]);
      expect(plan.seasonIdsToUpdate).toEqual(["season-1", "season-2"]);
      expect(plan.seriesPatch.id).toBe("series-a");
      expect(plan.seriesPatch.title).toBe("Test Series Name");
      expect(plan.extractedGenres).toHaveLength(2);
      expect(plan.extractedGenres[0].name).toBe("Action");
    });
  });

  describe("mergeSeries dry-run execution", () => {
    it("fetches seasons from DB, calls fetcher, logs dry-run details, and performs no mutations", async () => {
      const mockSeasonsData: SeasonInput[] = [
        { id: "season-1", seriesId: "series-1", tmdbId: 100, title: "S1" },
        { id: "season-2", seriesId: "series-2", tmdbId: 100, title: "S2" },
      ];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockSeasonsData),
          }),
        }),
        update: vi.fn(),
        delete: vi.fn(),
        insert: vi.fn(),
      };

      const mockFetchTvDetails = vi.fn().mockResolvedValue(mockTvDetails);
      const mockLogger = vi.fn();

      const summary = await mergeSeries({
        db: mockDb,
        dryRun: true,
        fetchTvDetails: mockFetchTvDetails,
        logger: mockLogger,
        delayMs: 0,
      });

      expect(summary.dryRun).toBe(true);
      expect(summary.processedTmdbIds).toBe(1);
      expect(summary.totalSeasonsRelinked).toBe(2);
      expect(summary.totalDuplicatesDeleted).toBe(1);
      expect(summary.totalGenresExtracted).toBe(2);

      expect(mockDb.select).toHaveBeenCalledTimes(1);
      // Verify NO destructive DML queries were called
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();

      expect(mockFetchTvDetails).toHaveBeenCalledWith(100);

      // Verify dry-run logs were emitted
      const loggedText = mockLogger.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(loggedText).toContain("[DRY RUN MODE: true]");
      expect(loggedText).toContain('TMDB ID 100 ("Test Series Name")');
      expect(loggedText).toContain("Canonical Series ID: series-1");
      expect(loggedText).toContain("Duplicate Series to delete (1): [series-2]");
      expect(loggedText).toContain("[DRY RUN GUARANTEE] No DML/DDL queries (TRUNCATE, UPDATE, DELETE) were executed.");
    });

    it("handles fetcher errors gracefully without stopping the pipeline", async () => {
      const mockSeasonsData: SeasonInput[] = [
        { id: "season-1", seriesId: "series-1", tmdbId: 100, title: "S1" },
        { id: "season-3", seriesId: "series-3", tmdbId: 300, title: "S3" },
      ];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockSeasonsData),
          }),
        }),
      };

      const mockFetchTvDetails = vi.fn().mockImplementation(async (id: number) => {
        if (id === 100) {
          throw new Error("404 Not Found");
        }
        return { ...mockTvDetails, id };
      });

      const mockLogger = vi.fn();

      const summary = await mergeSeries({
        db: mockDb,
        dryRun: true,
        fetchTvDetails: mockFetchTvDetails,
        logger: mockLogger,
        delayMs: 0,
      });

      expect(summary.processedTmdbIds).toBe(1); // 300 succeeded, 100 failed
      const loggedText = mockLogger.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(loggedText).toContain("⚠️ Failed to fetch or process TMDB ID 100: 404 Not Found");
    });
  });

  describe("mergeSeries live database execution (dryRun: false)", () => {
    it("executes database mutations including TRUNCATE, UPDATE, INSERT genres/mappings, and DELETE duplicates", async () => {
      const mockSeasonsData: SeasonInput[] = [
        { id: "season-1", seriesId: "series-1", tmdbId: 100, title: "S1" },
        { id: "season-2", seriesId: "series-2", tmdbId: 100, title: "S2" },
      ];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockSeasonsData),
          }),
        }),
        execute: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue([]),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      };

      const mockFetchTvDetails = vi.fn().mockResolvedValue(mockTvDetails);
      const mockLogger = vi.fn();

      const summary = await mergeSeries({
        db: mockDb,
        dryRun: false,
        fetchTvDetails: mockFetchTvDetails,
        logger: mockLogger,
        delayMs: 0,
      });

      expect(summary.dryRun).toBe(false);
      expect(summary.processedTmdbIds).toBe(1);
      expect(summary.totalSeasonsRelinked).toBe(2);
      expect(summary.totalDuplicatesDeleted).toBe(1);

      // Verify DML/DDL queries executed
      expect(mockDb.execute).toHaveBeenCalledTimes(1); // TRUNCATE TABLE genres CASCADE
      expect(mockDb.update).toHaveBeenCalledTimes(2); // 1 series update + 1 seasons update
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // 1 genres insert + 1 series_to_genres insert
      expect(mockDb.delete).toHaveBeenCalledTimes(1); // 1 series delete for series-2

      const loggedText = mockLogger.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(loggedText).toContain("[DRY RUN MODE: false]");
      expect(loggedText).toContain("[DB EXECUTION] Applying merge database mutations...");
      expect(loggedText).toContain("[DB EXECUTION] All database mutations completed successfully.");
    });
  });
});
