import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  ARCHIVE_INGEST_ACTIVE_STATUSES,
  MVP_MEDIA_OPENAPI,
  MVP_MEDIA_PUBLIC_PATHS,
  SCRAPER_PROVIDERS,
} from "../../src";
import type {
  AdminDashboardCatalogStats,
  AdminDashboardStorageStats,
  AdminEpisodeItem,
  AdminSeriesDetails,
  AdminVideoSourceItem,
  ArchiveIngestJob,
  ArchiveIngestJobEntry,
  ArchiveIngestJobSelectionItem,
  ArchiveIngestJobStatus,
  GenreItem,
  MediaErrorEnvelope,
  MediaSuccessEnvelope,
  ScraperProvider,
} from "../../src";

describe("Contracts property-based tests", () => {
  describe("Archive ingest DTOs and invariants", () => {
    const allStatuses: readonly ArchiveIngestJobStatus[] = [
      "queued",
      "downloading",
      "listing",
      "ready",
      "uploading",
      "done",
      "failed",
      "cancelled",
      "expired",
    ];

    it("verifies ARCHIVE_INGEST_ACTIVE_STATUSES is a strict deduplicated subset of all statuses", () => {
      expect(ARCHIVE_INGEST_ACTIVE_STATUSES.length).toBeLessThan(
        allStatuses.length,
      );
      const uniqueActive = new Set(ARCHIVE_INGEST_ACTIVE_STATUSES);
      expect(uniqueActive.size).toBe(ARCHIVE_INGEST_ACTIVE_STATUSES.length);

      for (const status of ARCHIVE_INGEST_ACTIVE_STATUSES) {
        expect(allStatuses).toContain(status);
      }
    });

    const statusArb = fc.constantFrom(...allStatuses);

    const entryArb: fc.Arbitrary<ArchiveIngestJobEntry> = fc.record({
      filename: fc.stringMatching(/^[a-zA-Z0-9._-]{1,30}$/),
      sizeBytes: fc.option(fc.integer({ min: 0, max: 10_000_000_000 }), {
        nil: null,
      }),
      detectedEpisodeNumber: fc.option(fc.integer({ min: 1, max: 2000 }), {
        nil: null,
      }),
      quality: fc.option(fc.constantFrom("360p", "480p", "720p", "1080p"), {
        nil: null,
      }),
      needsReview: fc.option(fc.boolean(), { nil: undefined }),
    });

    const selectionItemArb: fc.Arbitrary<ArchiveIngestJobSelectionItem> =
      fc.record({
        filename: fc.stringMatching(/^[a-zA-Z0-9._-]{1,30}$/),
        episodeId: fc.option(fc.uuid(), { nil: null }),
        label: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
          nil: null,
        }),
        quality: fc.option(fc.constantFrom("720p", "1080p"), { nil: null }),
        isIgnored: fc.option(fc.boolean(), { nil: undefined }),
        completed: fc.option(fc.boolean(), { nil: undefined }),
        videoSourceId: fc.option(fc.uuid(), { nil: null }),
      });

    const isoDateArb = fc
      .integer({ min: 1_500_000_000_000, max: 2_000_000_000_000 })
      .map((t) => new Date(t).toISOString());

    const archiveJobArb: fc.Arbitrary<ArchiveIngestJob> = fc.record({
      id: fc.uuid(),
      ownerId: fc.uuid(),
      seriesId: fc.option(fc.uuid(), { nil: null }),
      sourceKey: fc.string({ minLength: 1, maxLength: 30 }),
      sourceUrl: fc.webUrl(),
      referer: fc.option(fc.webUrl(), { nil: null }),
      status: statusArb,
      stage: statusArb,
      bytesDone: fc.integer({ min: 0, max: 50_000_000_000 }),
      bytesTotal: fc.option(fc.integer({ min: 0, max: 50_000_000_000 }), {
        nil: null,
      }),
      stagingPath: fc.option(fc.string({ minLength: 1, maxLength: 50 }), {
        nil: null,
      }),
      archiveFilename: fc.option(fc.string({ minLength: 1, maxLength: 50 }), {
        nil: null,
      }),
      entries: fc.array(entryArb, { maxLength: 5 }),
      selection: fc.array(selectionItemArb, { maxLength: 5 }),
      storageProviderId: fc.option(fc.uuid(), { nil: null }),
      errorCode: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
        nil: null,
      }),
      errorMessage: fc.option(fc.string({ minLength: 1, maxLength: 50 }), {
        nil: null,
      }),
      createdAt: isoDateArb,
      updatedAt: isoDateArb,
      expiresAt: fc.option(isoDateArb, { nil: null }),
    });

    it("round-trips arbitrary ArchiveIngestJob DTOs through JSON serialization", () => {
      fc.assert(
        fc.property(archiveJobArb, (job) => {
          const serialized = JSON.stringify(job);
          const parsed = JSON.parse(serialized) as ArchiveIngestJob;
          expect(parsed).toEqual(job);
          return (
            parsed.id === job.id &&
            parsed.status === job.status &&
            parsed.entries.length === job.entries.length &&
            parsed.selection.length === job.selection.length
          );
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("Envelope contracts and invariants", () => {
    it("ensures MediaSuccessEnvelope and MediaErrorEnvelope remain disjoint", () => {
      fc.assert(
        fc.property(
          fc.jsonValue(),
          fc.string(),
          fc.string(),
          (data, code, message) => {
            const success: MediaSuccessEnvelope<unknown> = { data };
            const error: MediaErrorEnvelope = { error: { code, message } };

            const hasErrorInSuccess =
              "error" in (success as Record<string, unknown>);
            const hasDataInError = "data" in (error as Record<string, unknown>);

            return !hasErrorInSuccess && !hasDataInError;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("round-trips success and error envelopes through JSON serialization", () => {
      fc.assert(
        fc.property(
          fc.jsonValue(),
          fc.string(),
          fc.string(),
          (payload, code, message) => {
            const successEnv: MediaSuccessEnvelope<unknown> = { data: payload };
            const successSerialized = JSON.stringify(successEnv);
            const successParsed = JSON.parse(
              successSerialized,
            ) as MediaSuccessEnvelope<unknown>;
            expect(JSON.stringify(successParsed)).toBe(successSerialized);

            const errorEnv: MediaErrorEnvelope = { error: { code, message } };
            const errorSerialized = JSON.stringify(errorEnv);
            const errorParsed = JSON.parse(
              errorSerialized,
            ) as MediaErrorEnvelope;
            expect(errorParsed).toEqual(errorEnv);

            return "data" in successParsed && "error" in errorParsed;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("Scraper providers contract", () => {
    it("verifies SCRAPER_PROVIDERS exhaustiveness and validity", () => {
      const expectedProviders: readonly ScraperProvider[] = [
        "otakudesu",
        "dramula",
      ];
      expect(SCRAPER_PROVIDERS).toHaveLength(expectedProviders.length);

      for (const provider of SCRAPER_PROVIDERS) {
        expect(expectedProviders).toContain(provider);
      }
    });
  });

  describe("OpenAPI MVP media contracts and invariants", () => {
    it("guarantees every public MVP path is defined with responses in MVP_MEDIA_OPENAPI", () => {
      expect(MVP_MEDIA_PUBLIC_PATHS.length).toBeGreaterThan(0);

      const paths = MVP_MEDIA_OPENAPI.paths as Record<string, unknown>;
      for (const publicPath of MVP_MEDIA_PUBLIC_PATHS) {
        expect(paths).toHaveProperty(publicPath);
        const pathItem = paths[publicPath] as Record<string, unknown>;
        expect(pathItem).toBeDefined();
        expect(pathItem.get).toBeDefined();
      }
    });

    it("is strictly idempotent under JSON serialization", () => {
      const serialized = JSON.stringify(MVP_MEDIA_OPENAPI);
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(MVP_MEDIA_OPENAPI);
    });
  });

  describe("Catalog and Dashboard DTO round-trips", () => {
    const catalogStatsArb: fc.Arbitrary<AdminDashboardCatalogStats> = fc.record(
      {
        totalSeries: fc.integer({ min: 0, max: 100_000 }),
        ongoingSeriesCount: fc.integer({ min: 0, max: 10_000 }),
        featuredSeriesCount: fc.integer({ min: 0, max: 500 }),
        totalSeasons: fc.integer({ min: 0, max: 50_000 }),
        totalEpisodes: fc.integer({ min: 0, max: 500_000 }),
        totalGenres: fc.integer({ min: 0, max: 500 }),
      },
    );

    const storageStatsArb: fc.Arbitrary<AdminDashboardStorageStats> = fc.record(
      {
        totalUsedBytes: fc.integer({ min: 0, max: 1_000_000_000_000 }),
        totalLimitBytes: fc.integer({ min: 0, max: 2_000_000_000_000 }),
        percentUsed: fc.float({ min: 0, max: 100, noNaN: true }),
        providerCount: fc.integer({ min: 0, max: 20 }),
      },
    );

    const genreItemArb: fc.Arbitrary<GenreItem> = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      slug: fc.stringMatching(/^[a-z0-9-]{1,30}$/),
      isBigGenre: fc.boolean(),
      displayOrder: fc.integer({ min: 0, max: 1000 }),
    });

    const videoSourceArb: fc.Arbitrary<AdminVideoSourceItem> = fc.record({
      id: fc.uuid(),
      type: fc.constantFrom("s3", "direct", "embed"),
      url: fc.webUrl(),
      label: fc.string({ minLength: 1, maxLength: 20 }),
      quality: fc.option(fc.constantFrom("360p", "480p", "720p", "1080p"), {
        nil: undefined,
      }),
    });

    const episodeArb: fc.Arbitrary<AdminEpisodeItem> = fc.record({
      id: fc.uuid(),
      title: fc.string({ minLength: 1, maxLength: 50 }),
      videoSources: fc.array(videoSourceArb, { maxLength: 3 }),
      createdAt: fc.string(),
      updatedAt: fc.string(),
    });

    const seriesDetailsArb: fc.Arbitrary<AdminSeriesDetails> = fc.record({
      id: fc.uuid(),
      title: fc.string({ minLength: 1, maxLength: 50 }),
      sourceUrl: fc.webUrl(),
      source: fc.constantFrom("otakudesu", "dramula"),
      logoUrl: fc.option(fc.webUrl(), { nil: null }),
      posterUrl: fc.option(fc.webUrl(), { nil: null }),
      description: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
      createdAt: fc.string(),
      updatedAt: fc.string(),
      seasons: fc.constant([]),
      episodes: fc.array(episodeArb, { maxLength: 3 }),
    });

    it("round-trips catalog and storage stats DTOs through JSON serialization", () => {
      fc.assert(
        fc.property(catalogStatsArb, storageStatsArb, (catalog, storage) => {
          const parsedCatalog = JSON.parse(JSON.stringify(catalog));
          const parsedStorage = JSON.parse(JSON.stringify(storage));
          expect(parsedCatalog).toEqual(catalog);
          expect(parsedStorage).toEqual(storage);
          return (
            parsedCatalog.totalSeries >= 0 &&
            parsedStorage.percentUsed >= 0 &&
            parsedStorage.percentUsed <= 100
          );
        }),
        { numRuns: 100 },
      );
    });

    it("round-trips GenreItem and AdminSeriesDetails DTOs through JSON serialization", () => {
      fc.assert(
        fc.property(genreItemArb, seriesDetailsArb, (genre, series) => {
          const parsedGenre = JSON.parse(JSON.stringify(genre));
          const parsedSeries = JSON.parse(JSON.stringify(series));
          expect(parsedGenre).toEqual(genre);
          expect(parsedSeries).toEqual(series);
          return (
            parsedGenre.id === genre.id &&
            parsedSeries.episodes.length === series.episodes.length
          );
        }),
        { numRuns: 100 },
      );
    });
  });
});
