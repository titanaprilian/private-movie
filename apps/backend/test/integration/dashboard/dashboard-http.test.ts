import { describe, expect, it, beforeAll } from "vitest";
import {
  episodes as episodesTable,
  genres as genresTable,
  seasons as seasonsTable,
  series as seriesTable,
  storageProviders as storageProvidersTable,
} from "@repo/db";
import type { AdminDashboardDto } from "@repo/contracts";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";

type DataResponse<T> = { data: T };

async function seedCatalog() {
  const now = new Date();
  const [g1] = await db
    .insert(genresTable)
    .values({ id: crypto.randomUUID(), name: "Action", slug: `action-${crypto.randomUUID()}`, createdAt: now, updatedAt: now })
    .returning();
  const [g2] = await db
    .insert(genresTable)
    .values({ id: crypto.randomUUID(), name: "Drama", slug: `drama-${crypto.randomUUID()}`, createdAt: now, updatedAt: now })
    .returning();

  const [s1] = await db
    .insert(seriesTable)
    .values({
      id: crypto.randomUUID(),
      title: "Ongoing Featured",
      isFeatured: true,
      isOngoingHighlighted: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const [s2] = await db
    .insert(seriesTable)
    .values({ id: crypto.randomUUID(), title: "Plain", createdAt: now, updatedAt: now })
    .returning();

  const [season1] = await db
    .insert(seasonsTable)
    .values({ id: crypto.randomUUID(), seriesId: s1.id, title: "Season 1", seasonNumber: 1, createdAt: now, updatedAt: now })
    .returning();
  const [season2] = await db
    .insert(seasonsTable)
    .values({ id: crypto.randomUUID(), seriesId: s2.id, title: "Season 1", seasonNumber: 1, createdAt: now, updatedAt: now })
    .returning();

  await db.insert(episodesTable).values([
    { id: crypto.randomUUID(), seasonId: season1.id, title: "E1", order: 1, createdAt: now, updatedAt: now },
    { id: crypto.randomUUID(), seasonId: season1.id, title: "E2", order: 2, createdAt: now, updatedAt: now },
    { id: crypto.randomUUID(), seasonId: season2.id, title: "E1", order: 1, createdAt: now, updatedAt: now },
  ]);

  return { g1, g2, s1, s2 };
}

describe("GET /api/admin/dashboard", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    const auth = await registerUser(app);
    headers = authHeaders(auth.accessToken);
  });

  it("returns 401 without a Bearer token", async () => {
    const res = await request(app, { path: "/api/admin/dashboard" });
    expect(res.status).toBe(401);
  });

  it("returns zeroed catalog stats on an empty database", async () => {
    const res = await request(app, { path: "/api/admin/dashboard", headers });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<AdminDashboardDto>;
    expect(body.data.catalog).toEqual({
      totalSeries: 0,
      ongoingSeriesCount: 0,
      featuredSeriesCount: 0,
      totalSeasons: 0,
      totalEpisodes: 0,
      totalGenres: 0,
    });
  });

  it("returns accurate catalog aggregation for seeded data", async () => {
    await seedCatalog();
    const res = await request(app, { path: "/api/admin/dashboard", headers });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<AdminDashboardDto>;
    // Seeded seasons default to status "completed", so the ongoing count is 0
    // even though one series carries the isOngoingHighlighted curation flag.
    expect(body.data.catalog).toEqual({
      totalSeries: 2,
      ongoingSeriesCount: 0,
      featuredSeriesCount: 1,
      totalSeasons: 2,
      totalEpisodes: 3,
      totalGenres: 2,
    });
  });

  it("aggregates storage limits across enabled providers only", async () => {
    const now = new Date();
    const GB = 1024 * 1024 * 1024;
    await db.insert(storageProvidersTable).values([
      {
        id: crypto.randomUUID(),
        name: "Enabled A",
        providerType: "minio",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "bucket-a",
        accessKeyIdEnc: "enc",
        secretAccessKeyEnc: "enc",
        storageLimitGb: 50,
        isDefault: true,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: "Enabled B",
        providerType: "minio",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "bucket-b",
        accessKeyIdEnc: "enc",
        secretAccessKeyEnc: "enc",
        storageLimitGb: 100,
        isDefault: false,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: "Disabled C",
        providerType: "minio",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "bucket-c",
        accessKeyIdEnc: "enc",
        secretAccessKeyEnc: "enc",
        storageLimitGb: 500,
        isDefault: false,
        isEnabled: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const res = await request(app, { path: "/api/admin/dashboard", headers });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<AdminDashboardDto>;
    expect(body.data.storage.providerCount).toBe(2);
    expect(body.data.storage.totalLimitBytes).toBe(150 * GB);
    expect(body.data.storage.totalUsedBytes).toBe(0);
    expect(body.data.storage.percentUsed).toBe(0);
  });

  it("returns the 5 most recently updated series with episode counts in order", async () => {
    const base = Date.now();
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      const updatedAt = new Date(base - (7 - i) * 60_000);
      const [s] = await db
        .insert(seriesTable)
        .values({
          id: crypto.randomUUID(),
          title: `Series ${i}`,
          posterUrl: i % 2 === 0 ? `https://img.example/p${i}.jpg` : null,
          createdAt: updatedAt,
          updatedAt,
        })
        .returning();
      ids.push(s.id);
      const [season] = await db
        .insert(seasonsTable)
        .values({
          id: crypto.randomUUID(),
          seriesId: s.id,
          title: "Season 1",
          seasonNumber: 1,
          createdAt: updatedAt,
          updatedAt,
        })
        .returning();
      const eps = Array.from({ length: i }, (_, k) => ({
        id: crypto.randomUUID(),
        seasonId: season.id,
        title: `E${k + 1}`,
        order: k + 1,
        createdAt: updatedAt,
        updatedAt,
      }));
      if (eps.length > 0) await db.insert(episodesTable).values(eps);
    }
    const res = await request(app, { path: "/api/admin/dashboard", headers });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<AdminDashboardDto>;
    expect(body.data.recentSeries).toHaveLength(5);
    // Most recently updated first: Series 6 .. Series 2
    expect(body.data.recentSeries.map((s) => s.title)).toEqual([
      "Series 6",
      "Series 5",
      "Series 4",
      "Series 3",
      "Series 2",
    ]);
    expect(body.data.recentSeries[0]).toMatchObject({
      id: ids[6],
      episodeCount: 6,
      posterUrl: "https://img.example/p6.jpg",
    });
    expect(typeof body.data.recentSeries[0].updatedAt).toBe("string");
  });

  it("counts ongoing series by seasons.status and returns ongoing season payloads", async () => {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600_000);
    // Series WITHOUT the highlight flag but WITH an ongoing season — must count.
    const [s1] = await db
      .insert(seriesTable)
      .values({
        id: crypto.randomUUID(),
        title: "Airing Show",
        posterUrl: "https://img.example/airing.jpg",
        isOngoingHighlighted: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const [ongoingSeason] = await db
      .insert(seasonsTable)
      .values({
        id: crypto.randomUUID(),
        seriesId: s1.id,
        title: "Season 2",
        seasonNumber: 2,
        status: "ongoing",
        lastScrapedAt: hourAgo,
        lastScrapeError: "Failed to fetch provider HTML: timeout",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await db.insert(episodesTable).values([
      { id: crypto.randomUUID(), seasonId: ongoingSeason.id, title: "E1", order: 1, createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), seasonId: ongoingSeason.id, title: "E2", order: 2, createdAt: now, updatedAt: now },
    ]);
    // Series WITH the highlight flag but only completed seasons — must NOT count.
    const [s2] = await db
      .insert(seriesTable)
      .values({
        id: crypto.randomUUID(),
        title: "Finished Highlight",
        isOngoingHighlighted: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const [doneSeason] = await db
      .insert(seasonsTable)
      .values({
        id: crypto.randomUUID(),
        seriesId: s2.id,
        title: "Season 1",
        seasonNumber: 1,
        status: "completed",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await db.insert(episodesTable).values([
      { id: crypto.randomUUID(), seasonId: doneSeason.id, title: "E1", order: 1, createdAt: now, updatedAt: now },
    ]);

    const res = await request(app, { path: "/api/admin/dashboard", headers });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<AdminDashboardDto>;
    expect(body.data.catalog.ongoingSeriesCount).toBe(1);
    expect(body.data.ongoingSeasons).toHaveLength(1);
    expect(body.data.ongoingSeasons[0]).toMatchObject({
      seasonId: ongoingSeason.id,
      seriesId: s1.id,
      seriesTitle: "Airing Show",
      seasonTitle: "Season 2",
      seasonNumber: 2,
      posterUrl: "https://img.example/airing.jpg",
      episodeCount: 2,
      lastScrapeError: "Failed to fetch provider HTML: timeout",
    });
    expect(body.data.ongoingSeasons[0].lastScrapedAt).toBe(hourAgo.toISOString());
  });

  it("returns an empty ongoing list with zero count when nothing is airing", async () => {
    const now = new Date();
    const [s] = await db
      .insert(seriesTable)
      .values({ id: crypto.randomUUID(), title: "Done", createdAt: now, updatedAt: now })
      .returning();
    await db.insert(seasonsTable).values({
      id: crypto.randomUUID(),
      seriesId: s.id,
      title: "Season 1",
      seasonNumber: 1,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });
    const res = await request(app, { path: "/api/admin/dashboard", headers });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<AdminDashboardDto>;
    expect(body.data.catalog.ongoingSeriesCount).toBe(0);
    expect(body.data.ongoingSeasons).toEqual([]);
  });
});

describe("GET /api/admin/dashboard storage usage", () => {
  const GB = 1024 * 1024 * 1024;
  let app: App;
  let headers: Record<string, string>;

  async function seedProviders() {
    const now = new Date();
    await db.insert(storageProvidersTable).values([
      {
        id: crypto.randomUUID(),
        name: "Usage A",
        providerType: "minio",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "bucket-a",
        accessKeyIdEnc: "enc",
        secretAccessKeyEnc: "enc",
        storageLimitGb: 50,
        isDefault: true,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: "Usage B",
        providerType: "minio",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "bucket-b",
        accessKeyIdEnc: "enc",
        secretAccessKeyEnc: "enc",
        storageLimitGb: 100,
        isDefault: false,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }

  beforeAll(async () => {
    app = await buildApp({
      storageUsageProvider: { async getTotalUsedBytes() { return 5 * GB; } },
    });
    const auth = await registerUser(app);
    headers = authHeaders(auth.accessToken);
  });

  it("reports real usage and percentage from the injected usage provider", async () => {
    await seedProviders();
    const res = await request(app, { path: "/api/admin/dashboard", headers });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<AdminDashboardDto>;
    expect(body.data.storage.providerCount).toBe(2);
    expect(body.data.storage.totalLimitBytes).toBe(150 * GB);
    expect(body.data.storage.totalUsedBytes).toBe(5 * GB);
    expect(body.data.storage.percentUsed).toBeCloseTo(3.33, 2);
  });

  it("falls back to untracked (0 used) when the usage provider throws", async () => {
    const failingApp = await buildApp({
      storageUsageProvider: {
        async getTotalUsedBytes() {
          throw new Error("S3 unreachable");
        },
      },
    });
    const auth = await registerUser(failingApp);
    const failingHeaders = authHeaders(auth.accessToken);
    await seedProviders();
    const res = await request(failingApp, { path: "/api/admin/dashboard", headers: failingHeaders });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<AdminDashboardDto>;
    expect(body.data.storage.totalLimitBytes).toBe(150 * GB);
    expect(body.data.storage.totalUsedBytes).toBe(0);
    expect(body.data.storage.percentUsed).toBe(0);
  });
});
