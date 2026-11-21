import { describe, expect, it } from "vitest";
import {
  episodes as episodesTable,
  genres as genresTable,
  seasons as seasonsTable,
  series as seriesTable,
  storageProviders as storageProvidersTable,
} from "@repo/db";
import {
  createDashboardRepository,
  saveSchedulerConfig,
} from "../../../src/modules/dashboard";
import { db } from "../../utils/db";

describe("dashboard repository catalog stats", () => {
  it("returns zero counts on an empty database", async () => {
    const repo = createDashboardRepository(db);
    const stats = await repo.getCatalogStats();

    expect(stats).toEqual({
      totalSeries: 0,
      ongoingSeriesCount: 0,
      featuredSeriesCount: 0,
      totalSeasons: 0,
      totalEpisodes: 0,
      totalGenres: 0,
    });
  });

  it("calculates real counts with distinct ongoing series and featured highlights", async () => {
    const now = new Date();

    // 3 genres
    await db.insert(genresTable).values([
      {
        id: crypto.randomUUID(),
        name: "Action",
        slug: "action",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: "Comedy",
        slug: "comedy",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: "Drama",
        slug: "drama",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 2 series: 1 featured, 1 regular
    const [s1] = await db
      .insert(seriesTable)
      .values({
        id: crypto.randomUUID(),
        title: "Featured Series",
        isFeatured: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [s2] = await db
      .insert(seriesTable)
      .values({
        id: crypto.randomUUID(),
        title: "Regular Series",
        isFeatured: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // s1 has TWO ongoing seasons (tests distinct ongoingSeriesCount calculation)
    const [s1Season1] = await db
      .insert(seasonsTable)
      .values({
        id: crypto.randomUUID(),
        seriesId: s1.id,
        title: "Season 1",
        seasonNumber: 1,
        status: "ongoing",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [s1Season2] = await db
      .insert(seasonsTable)
      .values({
        id: crypto.randomUUID(),
        seriesId: s1.id,
        title: "Season 2",
        seasonNumber: 2,
        status: "ongoing",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // s2 has ONE ended season
    const [s2Season1] = await db
      .insert(seasonsTable)
      .values({
        id: crypto.randomUUID(),
        seriesId: s2.id,
        title: "Season 1",
        seasonNumber: 1,
        status: "ended",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Episodes: 2 in s1Season1, 1 in s1Season2, 2 in s2Season1 = 5 total
    await db.insert(episodesTable).values([
      {
        id: crypto.randomUUID(),
        seasonId: s1Season1.id,
        title: "E1",
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        seasonId: s1Season1.id,
        title: "E2",
        order: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        seasonId: s1Season2.id,
        title: "E1",
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        seasonId: s2Season1.id,
        title: "E1",
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        seasonId: s2Season1.id,
        title: "E2",
        order: 2,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const repo = createDashboardRepository(db);
    const stats = await repo.getCatalogStats();

    expect(stats).toEqual({
      totalSeries: 2,
      ongoingSeriesCount: 1, // s1 has 2 ongoing seasons but should be counted once
      featuredSeriesCount: 1,
      totalSeasons: 3,
      totalEpisodes: 5,
      totalGenres: 3,
    });
  });
});

describe("dashboard repository ongoing seasons", () => {
  it("returns empty array when no seasons exist", async () => {
    const repo = createDashboardRepository(db);
    const ongoing = await repo.getOngoingSeasons();
    expect(ongoing).toEqual([]);
  });

  it("returns ongoing seasons with grouped episode counts and mapped null values", async () => {
    const now = new Date("2026-03-01T12:00:00.000Z");

    const [seriesWithPoster] = await db
      .insert(seriesTable)
      .values({
        id: crypto.randomUUID(),
        title: "Anime Alpha",
        posterUrl: "https://example.com/poster-alpha.jpg",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [seriesWithoutPoster] = await db
      .insert(seriesTable)
      .values({
        id: crypto.randomUUID(),
        title: "Anime Beta",
        posterUrl: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Ongoing season with error, scrape date, and 2 episodes
    const [ongoingWithEpisodes] = await db
      .insert(seasonsTable)
      .values({
        id: crypto.randomUUID(),
        seriesId: seriesWithPoster.id,
        title: "Season 1",
        seasonNumber: 1,
        status: "ongoing",
        lastScrapedAt: now,
        lastScrapeError: "connection timed out",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db.insert(episodesTable).values([
      {
        id: crypto.randomUUID(),
        seasonId: ongoingWithEpisodes.id,
        title: "Ep 1",
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        seasonId: ongoingWithEpisodes.id,
        title: "Ep 2",
        order: 2,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Ongoing season without episodes, null seasonNumber, null scraper timestamps
    const [ongoingEmpty] = await db
      .insert(seasonsTable)
      .values({
        id: crypto.randomUUID(),
        seriesId: seriesWithoutPoster.id,
        title: "Special Season",
        seasonNumber: null,
        status: "ongoing",
        lastScrapedAt: null,
        lastScrapeError: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Non-ongoing season that must be excluded
    await db.insert(seasonsTable).values({
      id: crypto.randomUUID(),
      seriesId: seriesWithPoster.id,
      title: "Completed Prequel",
      seasonNumber: 0,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });

    const repo = createDashboardRepository(db);
    const ongoing = await repo.getOngoingSeasons();

    expect(ongoing).toHaveLength(2);

    const first = ongoing.find((s) => s.seasonId === ongoingWithEpisodes.id);
    expect(first).toEqual({
      seasonId: ongoingWithEpisodes.id,
      seriesId: seriesWithPoster.id,
      seriesTitle: "Anime Alpha",
      seasonTitle: "Season 1",
      seasonNumber: 1,
      posterUrl: "https://example.com/poster-alpha.jpg",
      episodeCount: 2,
      lastScrapedAt: "2026-03-01T12:00:00.000Z",
      lastScrapeError: "connection timed out",
    });

    const second = ongoing.find((s) => s.seasonId === ongoingEmpty.id);
    expect(second).toEqual({
      seasonId: ongoingEmpty.id,
      seriesId: seriesWithoutPoster.id,
      seriesTitle: "Anime Beta",
      seasonTitle: "Special Season",
      seasonNumber: null,
      posterUrl: null,
      episodeCount: 0,
      lastScrapedAt: null,
      lastScrapeError: null,
    });
  });
});

describe("dashboard repository recent series", () => {
  it("returns empty array when no series exist", async () => {
    const repo = createDashboardRepository(db);
    const recent = await repo.getRecentSeries();
    expect(recent).toEqual([]);
  });

  it("returns the top 5 most recently updated series with summed episode counts in order", async () => {
    const baseTime = new Date("2026-01-01T00:00:00.000Z").getTime();
    const createdSeries: Array<{ id: string; title: string }> = [];

    // Create 6 series with timestamps spaced 1 hour apart
    for (let i = 1; i <= 6; i++) {
      const updatedAt = new Date(baseTime + i * 3600 * 1000);
      const [s] = await db
        .insert(seriesTable)
        .values({
          id: crypto.randomUUID(),
          title: `Series ${i}`,
          posterUrl: i % 2 === 0 ? `https://example.com/p${i}.jpg` : null,
          createdAt: updatedAt,
          updatedAt,
        })
        .returning();
      createdSeries.push(s);
    }

    // Series 6 (most recent): 2 seasons, 3 episodes in season 1 and 2 in season 2 (sum = 5)
    const [s6Season1] = await db
      .insert(seasonsTable)
      .values({
        id: crypto.randomUUID(),
        seriesId: createdSeries[5].id,
        title: "S1",
        seasonNumber: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [s6Season2] = await db
      .insert(seasonsTable)
      .values({
        id: crypto.randomUUID(),
        seriesId: createdSeries[5].id,
        title: "S2",
        seasonNumber: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await db.insert(episodesTable).values([
      {
        id: crypto.randomUUID(),
        seasonId: s6Season1.id,
        title: "E1",
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        seasonId: s6Season1.id,
        title: "E2",
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        seasonId: s6Season1.id,
        title: "E3",
        order: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        seasonId: s6Season2.id,
        title: "E1",
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        seasonId: s6Season2.id,
        title: "E2",
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Series 5: 1 season with 1 episode
    const [s5Season] = await db
      .insert(seasonsTable)
      .values({
        id: crypto.randomUUID(),
        seriesId: createdSeries[4].id,
        title: "S1",
        seasonNumber: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await db.insert(episodesTable).values([
      {
        id: crypto.randomUUID(),
        seasonId: s5Season.id,
        title: "E1",
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Series 4, 3, 2, 1 have 0 seasons / 0 episodes

    const repo = createDashboardRepository(db);
    const recent = await repo.getRecentSeries();

    // Exactly 5 returned (Series 1 is omitted)
    expect(recent).toHaveLength(5);

    // Verify ordering: Series 6, 5, 4, 3, 2
    expect(recent.map((r) => r.id)).toEqual([
      createdSeries[5].id,
      createdSeries[4].id,
      createdSeries[3].id,
      createdSeries[2].id,
      createdSeries[1].id,
    ]);

    // Check episode count summation and ISO string date format
    expect(recent[0]).toEqual({
      id: createdSeries[5].id,
      title: "Series 6",
      posterUrl: "https://example.com/p6.jpg",
      episodeCount: 5,
      updatedAt: new Date(baseTime + 6 * 3600 * 1000).toISOString(),
    });

    expect(recent[1]).toEqual({
      id: createdSeries[4].id,
      title: "Series 5",
      posterUrl: null,
      episodeCount: 1,
      updatedAt: new Date(baseTime + 5 * 3600 * 1000).toISOString(),
    });

    // Zero-episode series correctly default to 0
    expect(recent[2].episodeCount).toBe(0);
  });
});

describe("dashboard repository storage provider limits", () => {
  it("returns empty array when no storage providers exist", async () => {
    const repo = createDashboardRepository(db);
    const limits = await repo.getStorageProviderLimits();
    expect(limits).toEqual([]);
  });

  it("filters to enabled providers only and returns their storage limits", async () => {
    const now = new Date();
    await db.insert(storageProvidersTable).values([
      {
        id: crypto.randomUUID(),
        name: "Provider A",
        providerType: "minio",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "bucket-a",
        accessKeyIdEnc: "enc",
        secretAccessKeyEnc: "enc",
        storageLimitGb: 100,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: "Provider B",
        providerType: "minio",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "bucket-b",
        accessKeyIdEnc: "enc",
        secretAccessKeyEnc: "enc",
        storageLimitGb: 50,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: "Disabled Provider",
        providerType: "minio",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "bucket-c",
        accessKeyIdEnc: "enc",
        secretAccessKeyEnc: "enc",
        storageLimitGb: 200,
        isEnabled: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const repo = createDashboardRepository(db);
    const limits = await repo.getStorageProviderLimits();

    expect(limits).toEqual([{ storageLimitGb: 100 }, { storageLimitGb: 50 }]);
  });
});

describe("dashboard repository scheduler config", () => {
  it("returns default scheduler configuration when system table is unconfigured", async () => {
    const repo = createDashboardRepository(db);
    const config = await repo.getSchedulerConfig();

    expect(config).toEqual({
      intervalMinutes: 30,
      isEnabled: true,
    });
  });

  it("loads configured scheduler settings from the system table", async () => {
    await saveSchedulerConfig(db, {
      intervalMinutes: 60,
      isEnabled: false,
    });

    const repo = createDashboardRepository(db);
    const config = await repo.getSchedulerConfig();

    expect(config).toEqual({
      intervalMinutes: 60,
      isEnabled: false,
    });
  });
});
