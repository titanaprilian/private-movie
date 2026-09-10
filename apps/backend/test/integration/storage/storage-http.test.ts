import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  episodes as episodesTable,
  seasons as seasonsTable,
  series as seriesTable,
  system as systemTable,
  videoSources as videoSourcesTable,
  type VideoSourceRow,
} from "@repo/db";
import type { S3ObjectSummary, S3StorageService } from "@repo/media-service";
import type {
  StorageMetrics,
  StorageResourcesResponseData,
  StorageResourceItem,
  StorageLimitUpdateResponseData,
  StorageDeleteResponseData,
  StoragePurgeOrphansResponseData,
  StoragePreviewUrlResponseData,
} from "@repo/contracts";
import { buildApp, request } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";

type DataResponse<T> = { data: T };
type ErrorResponse = { error: { code: string; message: string } };

function createMockS3(
  objects: S3ObjectSummary[] = [],
  overrides?: Partial<S3StorageService>
): S3StorageService & {
  deleteObject: ReturnType<typeof vi.fn>;
  deleteObjects: ReturnType<typeof vi.fn>;
  listAllObjects: ReturnType<typeof vi.fn>;
} {
  let internalObjects = [...objects];
  return {
    isConfigured: () => true,
    getPresignedUploadUrl: async (key: string) => ({
      uploadUrl: `https://s3.example.com/${key}`,
      key,
    }),
    getPresignedPlaybackUrl: async (key: string) =>
      `https://s3.signed.com/${key}?expires=21600`,
    deleteObject: vi.fn(async (key: string) => {
      internalObjects = internalObjects.filter((o) => o.key !== key);
    }),
    deleteObjects: vi.fn(async (keys: string[]) => {
      const keySet = new Set(keys);
      internalObjects = internalObjects.filter((o) => !keySet.has(o.key));
    }),
    listAllObjects: vi.fn(async () => internalObjects),
    listObjects: vi.fn(async () => ({
      objects: internalObjects,
      isTruncated: false,
    })),
    getBucketStorageUsage: vi.fn(async () => ({
      totalSizeBytes: internalObjects.reduce((acc, o) => acc + o.size, 0),
      objectCount: internalObjects.length,
    })),
    uploadObject: vi.fn(async () => {}),
    uploadStream: vi.fn(async () => {}),
    ...overrides,
  } as S3StorageService & {
    deleteObject: ReturnType<typeof vi.fn>;
    deleteObjects: ReturnType<typeof vi.fn>;
    listAllObjects: ReturnType<typeof vi.fn>;
  };
}

async function createSeriesWithEpisode(params?: {
  seriesTitle?: string;
  seasonNumber?: number;
  episodeTitle?: string;
}) {
  const now = new Date();
  const [sRow] = await db
    .insert(seriesTable)
    .values({
      id: crypto.randomUUID(),
      title: params?.seriesTitle ?? "Test Anime Series",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [seasonRow] = await db
    .insert(seasonsTable)
    .values({
      id: crypto.randomUUID(),
      seriesId: sRow.id,
      title: "Season 1",
      seasonNumber: params?.seasonNumber ?? 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [epRow] = await db
    .insert(episodesTable)
    .values({
      id: crypto.randomUUID(),
      seasonId: seasonRow.id,
      title: params?.episodeTitle ?? "Episode 1",
      order: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return { series: sRow, season: seasonRow, episode: epRow };
}

async function insertVideoSource(
  episodeId: string,
  overrides?: Partial<{
    id: string;
    type: string;
    url: string;
    label: string;
    quality: string | null;
  }>
) {
  const now = new Date();
  const [sourceRow] = await db
    .insert(videoSourcesTable)
    .values({
      id: overrides?.id ?? crypto.randomUUID(),
      episodeId,
      type: overrides?.type ?? "s3",
      url: overrides?.url ?? `episodes/${episodeId}/video.mp4`,
      label: overrides?.label ?? "S3 1080p",
      quality: overrides?.quality ?? "1080p",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return sourceRow;
}

describe("Storage Management HTTP API (/api/storage/*)", () => {
  describe("Authentication Guard", () => {
    it("returns 401 for all storage endpoints without Bearer token", async () => {
      const app = await buildApp({ s3StorageService: createMockS3() });

      const endpoints = [
        { method: "GET", path: "/api/storage/metrics" },
        { method: "GET", path: "/api/storage/resources" },
        { method: "POST", path: "/api/storage/scan" },
        { method: "PUT", path: "/api/storage/limit", body: { limitGb: 50 } },
        { method: "PATCH", path: "/api/storage/resources/some-id", body: { label: "New" } },
        { method: "POST", path: "/api/storage/resources/attach", body: { key: "k", episodeId: "e" } },
        { method: "POST", path: "/api/storage/resources/delete", body: { keys: ["k"] } },
        { method: "POST", path: "/api/storage/resources/purge-orphans" },
        { method: "GET", path: "/api/storage/resources/preview-url?key=k" },
      ];

      for (const ep of endpoints) {
        const res = await request(app, {
          method: ep.method,
          path: ep.path,
          body: ep.body,
        });
        expect(res.status, `Endpoint ${ep.method} ${ep.path} should require auth`).toBe(401);
      }
    });

    it("returns 401 when an invalid Bearer token is provided", async () => {
      const app = await buildApp({ s3StorageService: createMockS3() });
      const res = await request(app, {
        method: "GET",
        path: "/api/storage/metrics",
        headers: { Authorization: "Bearer invalid-token-xyz" },
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/storage/metrics", () => {
    it("returns accurate storage metrics for linked and orphaned objects", async () => {
      const { episode } = await createSeriesWithEpisode();
      const linkedKey = `episodes/${episode.id}/linked-video.mp4`;
      await insertVideoSource(episode.id, { url: linkedKey });

      const mockObjects: S3ObjectSummary[] = [
        {
          key: linkedKey,
          size: 1_073_741_824, // 1 GB
          lastModified: new Date("2026-03-01T00:00:00Z"),
        },
        {
          key: "orphaned-files/orphan1.mp4",
          size: 2_147_483_648, // 2 GB
          lastModified: new Date("2026-03-02T00:00:00Z"),
        },
      ];

      const mockS3 = createMockS3(mockObjects);
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "GET",
        path: "/api/storage/metrics",
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const data = (res.body as DataResponse<StorageMetrics>).data;
      expect(data).toMatchObject({
        totalBytes: 3_221_225_472, // 3 GB
        limitBytes: 50 * 1024 * 1024 * 1024, // 50 GB default
        totalCount: 2,
        linkedCount: 1,
        orphanCount: 1,
      });
      expect(data.percentUsed).toBeCloseTo(6.0, 1);
    });

    it("returns 400 when S3 storage service is not configured", async () => {
      const unconfiguredS3: S3StorageService = {
        isConfigured: () => false,
        getPresignedUploadUrl: async () => { throw new Error("not configured"); },
        getPresignedPlaybackUrl: async () => { throw new Error("not configured"); },
        uploadObject: async () => {},
        uploadStream: async () => {},
        deleteObject: async () => {},
        deleteObjects: async () => {},
        listObjects: async () => { throw new Error("not configured"); },
        listAllObjects: async () => { throw new Error("not configured"); },
        getBucketStorageUsage: async () => { throw new Error("not configured"); },
      };

      const app = await buildApp({ s3StorageService: unconfiguredS3 });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "GET",
        path: "/api/storage/metrics",
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(400);
      expect((res.body as ErrorResponse).error.code).toBe("S3_NOT_CONFIGURED");
    });
  });

  describe("GET /api/storage/resources", () => {
    it("returns correlated inventory items with series, season, episode, and lone source indicators", async () => {
      const { series, season, episode } = await createSeriesWithEpisode({
        seriesTitle: "Attack on Titan",
        seasonNumber: 1,
        episodeTitle: "To You, in 2000 Years",
      });

      const linkedKey = `episodes/${episode.id}/ep1.mp4`;
      const source = await insertVideoSource(episode.id, {
        url: linkedKey,
        label: "Primary B2",
        quality: "1080p",
      });

      const orphanKey = "uploads/temp-orphan.mp4";

      const mockObjects: S3ObjectSummary[] = [
        {
          key: linkedKey,
          size: 500_000_000,
          lastModified: new Date("2026-03-01T12:00:00Z"),
        },
        {
          key: orphanKey,
          size: 250_000_000,
          lastModified: new Date("2026-03-02T12:00:00Z"),
        },
      ];

      const app = await buildApp({ s3StorageService: createMockS3(mockObjects) });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "GET",
        path: "/api/storage/resources",
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const data = (res.body as DataResponse<StorageResourcesResponseData>).data;
      expect(data.total).toBe(2);

      const linkedItem = data.items.find((i: StorageResourceItem) => i.key === linkedKey);
      expect(linkedItem).toBeDefined();
      expect(linkedItem).toMatchObject({
        key: linkedKey,
        filename: "ep1.mp4",
        status: "linked",
        videoSourceId: source.id,
        label: "Primary B2",
        quality: "1080p",
        episodeId: episode.id,
        episodeTitle: "To You, in 2000 Years",
        seasonId: season.id,
        seasonNumber: 1,
        seriesId: series.id,
        seriesTitle: "Attack on Titan",
        isLoneSource: true, // Only 1 source exists for this episode
      });

      const orphanItem = data.items.find((i: StorageResourceItem) => i.key === orphanKey);
      expect(orphanItem).toBeDefined();
      expect(orphanItem).toMatchObject({
        key: orphanKey,
        filename: "temp-orphan.mp4",
        status: "orphaned",
        videoSourceId: null,
        isLoneSource: false,
      });
    });

    it("marks isLoneSource as false when episode has multiple video sources", async () => {
      const { episode } = await createSeriesWithEpisode();
      const s3Key1 = `episodes/${episode.id}/source1.mp4`;
      const s3Key2 = `episodes/${episode.id}/source2.mp4`;

      await insertVideoSource(episode.id, { url: s3Key1 });
      await insertVideoSource(episode.id, { url: s3Key2 });

      const mockObjects: S3ObjectSummary[] = [
        { key: s3Key1, size: 100, lastModified: new Date() },
        { key: s3Key2, size: 100, lastModified: new Date() },
      ];

      const app = await buildApp({ s3StorageService: createMockS3(mockObjects) });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "GET",
        path: "/api/storage/resources",
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const data = (res.body as DataResponse<StorageResourcesResponseData>).data;
      expect(data.items[0].isLoneSource).toBe(false);
      expect(data.items[1].isLoneSource).toBe(false);
    });

    it("filters resources by status (linked vs orphaned)", async () => {
      const { episode } = await createSeriesWithEpisode();
      const linkedKey = `episodes/${episode.id}/linked.mp4`;
      await insertVideoSource(episode.id, { url: linkedKey });

      const mockObjects: S3ObjectSummary[] = [
        { key: linkedKey, size: 100, lastModified: new Date() },
        { key: "orphan.mp4", size: 100, lastModified: new Date() },
      ];

      const app = await buildApp({ s3StorageService: createMockS3(mockObjects) });
      const { accessToken } = await registerUser(app);

      // Filter linked
      const linkedRes = await request(app, {
        method: "GET",
        path: "/api/storage/resources?status=linked",
        headers: authHeaders(accessToken),
      });
      expect((linkedRes.body as DataResponse<StorageResourcesResponseData>).data.items).toHaveLength(1);
      expect((linkedRes.body as DataResponse<StorageResourcesResponseData>).data.items[0].status).toBe("linked");

      // Filter orphaned
      const orphanRes = await request(app, {
        method: "GET",
        path: "/api/storage/resources?status=orphaned",
        headers: authHeaders(accessToken),
      });
      expect((orphanRes.body as DataResponse<StorageResourcesResponseData>).data.items).toHaveLength(1);
      expect((orphanRes.body as DataResponse<StorageResourcesResponseData>).data.items[0].status).toBe("orphaned");
    });

    it("supports search query matching filename, series title, and episode title", async () => {
      const { episode } = await createSeriesWithEpisode({
        seriesTitle: "Demon Slayer",
        episodeTitle: "Cruelty",
      });
      const key = `episodes/${episode.id}/ds-ep01.mp4`;
      await insertVideoSource(episode.id, { url: key });

      const mockObjects: S3ObjectSummary[] = [
        { key, size: 100, lastModified: new Date() },
        { key: "other-video.mp4", size: 100, lastModified: new Date() },
      ];

      const app = await buildApp({ s3StorageService: createMockS3(mockObjects) });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "GET",
        path: "/api/storage/resources?search=slayer",
        headers: authHeaders(accessToken),
      });

      const data = (res.body as DataResponse<StorageResourcesResponseData>).data;
      expect(data.items).toHaveLength(1);
      expect(data.items[0].key).toBe(key);
    });

    it("supports sorting by size, name, and date ascending/descending", async () => {
      const mockObjects: S3ObjectSummary[] = [
        { key: "a.mp4", size: 300, lastModified: new Date("2026-01-01") },
        { key: "b.mp4", size: 100, lastModified: new Date("2026-03-01") },
        { key: "c.mp4", size: 200, lastModified: new Date("2026-02-01") },
      ];

      const app = await buildApp({ s3StorageService: createMockS3(mockObjects) });
      const { accessToken } = await registerUser(app);

      // Sort by size ascending
      const sizeAsc = await request(app, {
        method: "GET",
        path: "/api/storage/resources?sortBy=size&sortOrder=asc",
        headers: authHeaders(accessToken),
      });
      const sizeKeys = (sizeAsc.body as DataResponse<StorageResourcesResponseData>).data.items.map((i: StorageResourceItem) => i.key);
      expect(sizeKeys).toEqual(["b.mp4", "c.mp4", "a.mp4"]);

      // Sort by size descending
      const sizeDesc = await request(app, {
        method: "GET",
        path: "/api/storage/resources?sortBy=size&sortOrder=desc",
        headers: authHeaders(accessToken),
      });
      expect((sizeDesc.body as DataResponse<StorageResourcesResponseData>).data.items.map((i: StorageResourceItem) => i.key)).toEqual(["a.mp4", "c.mp4", "b.mp4"]);

      // Sort by name ascending
      const nameAsc = await request(app, {
        method: "GET",
        path: "/api/storage/resources?sortBy=name&sortOrder=asc",
        headers: authHeaders(accessToken),
      });
      expect((nameAsc.body as DataResponse<StorageResourcesResponseData>).data.items.map((i: StorageResourceItem) => i.key)).toEqual(["a.mp4", "b.mp4", "c.mp4"]);
    });

    it("supports pagination with page and limit", async () => {
      const mockObjects: S3ObjectSummary[] = [
        { key: "1.mp4", size: 100, lastModified: new Date("2026-01-03") },
        { key: "2.mp4", size: 100, lastModified: new Date("2026-01-02") },
        { key: "3.mp4", size: 100, lastModified: new Date("2026-01-01") },
      ];

      const app = await buildApp({ s3StorageService: createMockS3(mockObjects) });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "GET",
        path: "/api/storage/resources?page=2&limit=2",
        headers: authHeaders(accessToken),
      });

      const data = (res.body as DataResponse<StorageResourcesResponseData>).data;
      expect(data.page).toBe(2);
      expect(data.limit).toBe(2);
      expect(data.total).toBe(3);
      expect(data.totalPages).toBe(2);
      expect(data.items).toHaveLength(1);
    });
  });

  describe("POST /api/storage/scan", () => {
    it("invalidates cache and returns fresh scan metrics", async () => {
      const mockObjects: S3ObjectSummary[] = [
        { key: "f1.mp4", size: 1000, lastModified: new Date() },
        { key: "f2.mp4", size: 2000, lastModified: new Date() },
      ];
      const mockS3 = createMockS3(mockObjects);
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "POST",
        path: "/api/storage/scan",
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      expect((res.body as DataResponse<{ count: number; totalBytes: number }>).data).toEqual({
        count: 2,
        totalBytes: 3000,
      });
    });
  });

  describe("PUT /api/storage/limit", () => {
    it("persists a custom storage quota in system table and updates metrics", async () => {
      const app = await buildApp({ s3StorageService: createMockS3() });
      const { accessToken } = await registerUser(app);

      const updateRes = await request(app, {
        method: "PUT",
        path: "/api/storage/limit",
        headers: authHeaders(accessToken),
        body: { limitGb: 200 },
      });

      expect(updateRes.status).toBe(200);
      expect((updateRes.body as DataResponse<StorageLimitUpdateResponseData>).data).toEqual({
        limitGb: 200,
        limitBytes: 200 * 1024 * 1024 * 1024,
      });

      // Verify persisted in system table
      const [sysRow] = await db
        .select()
        .from(systemTable)
        .where(eq(systemTable.key, "s3_storage_limit_gb"));
      expect(sysRow?.value).toBe("200");

      // Verify reflected in GET /api/storage/metrics
      const metricsRes = await request(app, {
        method: "GET",
        path: "/api/storage/metrics",
        headers: authHeaders(accessToken),
      });
      expect((metricsRes.body as DataResponse<StorageMetrics>).data.limitBytes).toBe(200 * 1024 * 1024 * 1024);
    });

    it("rejects invalid or non-positive storage limits with 400", async () => {
      const app = await buildApp({ s3StorageService: createMockS3() });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "PUT",
        path: "/api/storage/limit",
        headers: authHeaders(accessToken),
        body: { limitGb: -10 },
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/storage/resources/:id", () => {
    it("updates label and quality of a video source", async () => {
      const { episode } = await createSeriesWithEpisode();
      const source = await insertVideoSource(episode.id, {
        label: "Old Label",
        quality: "720p",
      });

      const app = await buildApp({ s3StorageService: createMockS3() });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "PATCH",
        path: `/api/storage/resources/${source.id}`,
        headers: authHeaders(accessToken),
        body: {
          label: "Corrected 1080p Master",
          quality: "1080p",
        },
      });

      expect(res.status).toBe(200);
      expect((res.body as DataResponse<VideoSourceRow>).data).toMatchObject({
        id: source.id,
        label: "Corrected 1080p Master",
        quality: "1080p",
      });

      const [inDb] = await db
        .select()
        .from(videoSourcesTable)
        .where(eq(videoSourcesTable.id, source.id));
      expect(inDb?.label).toBe("Corrected 1080p Master");
    });

    it("returns 404 when updating a non-existent video source", async () => {
      const app = await buildApp({ s3StorageService: createMockS3() });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "PATCH",
        path: "/api/storage/resources/non-existent-id",
        headers: authHeaders(accessToken),
        body: { label: "New Label" },
      });

      expect(res.status).toBe(404);
      expect((res.body as ErrorResponse).error.code).toBe("VIDEO_SOURCE_NOT_FOUND");
    });
  });

  describe("POST /api/storage/resources/attach", () => {
    it("links an orphaned S3 key to an existing episode by creating a new video_sources row", async () => {
      const { episode } = await createSeriesWithEpisode();
      const orphanKey = "orphans/rescued-file.mp4";

      const mockObjects: S3ObjectSummary[] = [
        { key: orphanKey, size: 500, lastModified: new Date() },
      ];

      const app = await buildApp({ s3StorageService: createMockS3(mockObjects) });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "POST",
        path: "/api/storage/resources/attach",
        headers: authHeaders(accessToken),
        body: {
          key: orphanKey,
          episodeId: episode.id,
          label: "Rescued Source",
          quality: "1080p",
        },
      });

      expect(res.status).toBe(200);
      const createdSource = (res.body as DataResponse<VideoSourceRow>).data;
      expect(createdSource).toMatchObject({
        episodeId: episode.id,
        type: "s3",
        url: orphanKey,
        label: "Rescued Source",
        quality: "1080p",
      });

      // Verify inventory now lists this object as linked
      const resourcesRes = await request(app, {
        method: "GET",
        path: "/api/storage/resources",
        headers: authHeaders(accessToken),
      });
      const item = (resourcesRes.body as DataResponse<StorageResourcesResponseData>).data.items.find((i: StorageResourceItem) => i.key === orphanKey);
      expect(item?.status).toBe("linked");
      expect(item?.episodeId).toBe(episode.id);
    });

    it("returns 404 when attaching to a non-existent episode", async () => {
      const app = await buildApp({ s3StorageService: createMockS3() });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "POST",
        path: "/api/storage/resources/attach",
        headers: authHeaders(accessToken),
        body: {
          key: "some-key.mp4",
          episodeId: crypto.randomUUID(),
        },
      });

      expect(res.status).toBe(404);
      expect((res.body as ErrorResponse).error.code).toBe("EPISODE_NOT_FOUND");
    });
  });

  describe("POST /api/storage/resources/delete", () => {
    it("deletes S3 objects and removes corresponding video_sources while preserving episode records", async () => {
      const { episode } = await createSeriesWithEpisode();
      const linkedKey = `episodes/${episode.id}/file-to-delete.mp4`;
      const orphanKey = "orphans/orphan-to-delete.mp4";

      const source = await insertVideoSource(episode.id, { url: linkedKey });

      const mockObjects: S3ObjectSummary[] = [
        { key: linkedKey, size: 1000, lastModified: new Date() },
        { key: orphanKey, size: 500, lastModified: new Date() },
      ];

      const mockS3 = createMockS3(mockObjects);
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "POST",
        path: "/api/storage/resources/delete",
        headers: authHeaders(accessToken),
        body: {
          keys: [linkedKey, orphanKey],
        },
      });

      expect(res.status).toBe(200);
      expect((res.body as DataResponse<StorageDeleteResponseData>).data).toEqual({
        deletedKeys: [linkedKey, orphanKey],
        reclaimedBytes: 1500,
        deletedSourcesCount: 1,
      });

      expect(mockS3.deleteObjects).toHaveBeenCalledWith([linkedKey, orphanKey]);

      // Video source is deleted from DB
      const dbSources = await db
        .select()
        .from(videoSourcesTable)
        .where(eq(videoSourcesTable.id, source.id));
      expect(dbSources).toHaveLength(0);

      // Episode row is PRESERVED
      const dbEpisodes = await db
        .select()
        .from(episodesTable)
        .where(eq(episodesTable.id, episode.id));
      expect(dbEpisodes).toHaveLength(1);
    });

    it("rejects empty keys array with 400", async () => {
      const app = await buildApp({ s3StorageService: createMockS3() });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "POST",
        path: "/api/storage/resources/delete",
        headers: authHeaders(accessToken),
        body: { keys: [] },
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/storage/resources/purge-orphans", () => {
    it("deletes all unlinked S3 objects in batch", async () => {
      const { episode } = await createSeriesWithEpisode();
      const linkedKey = `episodes/${episode.id}/keep.mp4`;
      await insertVideoSource(episode.id, { url: linkedKey });

      const orphan1 = "orphans/del1.mp4";
      const orphan2 = "orphans/del2.mp4";

      const mockObjects: S3ObjectSummary[] = [
        { key: linkedKey, size: 5000, lastModified: new Date() },
        { key: orphan1, size: 1000, lastModified: new Date() },
        { key: orphan2, size: 2000, lastModified: new Date() },
      ];

      const mockS3 = createMockS3(mockObjects);
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "POST",
        path: "/api/storage/resources/purge-orphans",
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      expect((res.body as DataResponse<StoragePurgeOrphansResponseData>).data).toEqual({
        deletedKeys: [orphan1, orphan2],
        reclaimedBytes: 3000,
      });

      expect(mockS3.deleteObjects).toHaveBeenCalledWith([orphan1, orphan2]);
    });

    it("handles case where no orphans exist gracefully", async () => {
      const { episode } = await createSeriesWithEpisode();
      const linkedKey = `episodes/${episode.id}/keep.mp4`;
      await insertVideoSource(episode.id, { url: linkedKey });

      const mockObjects: S3ObjectSummary[] = [
        { key: linkedKey, size: 5000, lastModified: new Date() },
      ];

      const mockS3 = createMockS3(mockObjects);
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "POST",
        path: "/api/storage/resources/purge-orphans",
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      expect((res.body as DataResponse<StoragePurgeOrphansResponseData>).data).toEqual({
        deletedKeys: [],
        reclaimedBytes: 0,
      });
    });
  });

  describe("GET /api/storage/resources/preview-url", () => {
    it("returns a presigned playback URL for previewing an S3 file", async () => {
      const mockS3 = createMockS3();
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "GET",
        path: "/api/storage/resources/preview-url?key=episodes/123/video.mp4",
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      expect((res.body as DataResponse<StoragePreviewUrlResponseData>).data).toEqual({
        previewUrl: "https://s3.signed.com/episodes/123/video.mp4?expires=21600",
      });
    });

    it("returns 400 when key query parameter is missing", async () => {
      const app = await buildApp({ s3StorageService: createMockS3() });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "GET",
        path: "/api/storage/resources/preview-url",
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(400);
    });
  });
});
