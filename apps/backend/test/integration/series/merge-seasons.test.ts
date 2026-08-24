import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { createDbClient, episodes, seasons, series } from "@repo/db";
import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";

const db = createDbClient(process.env.DATABASE_URL!);

describe("POST /series/:id/seasons/merge", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    const user = await registerUser(app, {
      email: "merge-tester@example.com",
      password: "password123",
      name: "Merge Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when authorization header is missing", async () => {
    const nonexistentSeriesId = crypto.randomUUID();
    const result = await request(app, {
      method: "POST",
      path: `/series/${nonexistentSeriesId}/seasons/merge`,
      body: { orderedSeasonIds: [crypto.randomUUID(), crypto.randomUUID()] },
    });

    expect(result.status).toBe(401);
  });

  it("returns 404 when series does not exist", async () => {
    const nonexistentSeriesId = crypto.randomUUID();
    const result = await request(app, {
      method: "POST",
      path: `/series/${nonexistentSeriesId}/seasons/merge`,
      headers,
      body: { orderedSeasonIds: [crypto.randomUUID(), crypto.randomUUID()] },
    });

    expect(result.status).toBe(404);
  });

  it("returns 404 when a season ID in orderedSeasonIds does not exist", async () => {
    const [seriesRecord] = await db
      .insert(series)
      .values({
        id: crypto.randomUUID(),
        title: "Test Series Missing Season",
        type: "tv",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [season1] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId: seriesRecord.id,
        sourceUrl: "https://otakudesu.blog/anime/series-missing-s1",
        source: "otakudesu",
        title: "Season 1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const fakeSeasonId = crypto.randomUUID();

    const result = await request(app, {
      method: "POST",
      path: `/series/${seriesRecord.id}/seasons/merge`,
      headers,
      body: { orderedSeasonIds: [season1.id, fakeSeasonId] },
    });

    expect(result.status).toBe(404);
  });

  it("returns 404 when a season ID belongs to a different series", async () => {
    const [series1] = await db
      .insert(series)
      .values({
        id: crypto.randomUUID(),
        title: "Series 1",
        type: "tv",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [series2] = await db
      .insert(series)
      .values({
        id: crypto.randomUUID(),
        title: "Series 2",
        type: "tv",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [s1] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId: series1.id,
        sourceUrl: "https://otakudesu.blog/anime/s1-diff",
        source: "otakudesu",
        title: "Season 1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [s2Other] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId: series2.id,
        sourceUrl: "https://otakudesu.blog/anime/s2-diff",
        source: "otakudesu",
        title: "Season 2 Other Series",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const result = await request(app, {
      method: "POST",
      path: `/series/${series1.id}/seasons/merge`,
      headers,
      body: { orderedSeasonIds: [s1.id, s2Other.id] },
    });

    expect(result.status).toBe(404);
  });

  it("successfully merges duplicate seasons, renumbers episodes sequentially, updates seasonId, and deletes duplicate seasons", async () => {
    // 1. Create a series
    const [targetSeries] = await db
      .insert(series)
      .values({
        id: crypto.randomUUID(),
        title: "Attack on Titan Final Season",
        type: "tv",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 2. Create 3 duplicate seasons (Part 1, Part 2, Part 3)
    const [seasonPart1] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId: targetSeries.id,
        sourceUrl: "https://otakudesu.blog/anime/aot-final-part-1",
        source: "otakudesu",
        title: "AoT Final Part 1",
        createdAt: new Date(Date.now() - 3000),
        updatedAt: new Date(),
      })
      .returning();

    const [seasonPart2] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId: targetSeries.id,
        sourceUrl: "https://otakudesu.blog/anime/aot-final-part-2",
        source: "otakudesu",
        title: "AoT Final Part 2",
        createdAt: new Date(Date.now() - 2000),
        updatedAt: new Date(),
      })
      .returning();

    const [seasonPart3] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId: targetSeries.id,
        sourceUrl: "https://otakudesu.blog/anime/aot-final-part-3",
        source: "otakudesu",
        title: "AoT Final Part 3",
        createdAt: new Date(Date.now() - 1000),
        updatedAt: new Date(),
      })
      .returning();

    // 3. Create episodes in Part 1 (episodes order: 1, 2)
    const [ep1Part1] = await db
      .insert(episodes)
      .values({
        id: crypto.randomUUID(),
        seasonId: seasonPart1.id,
        sourceUrl: "https://otakudesu.blog/episode/aot-p1-ep1",
        source: "otakudesu",
        title: "AoT P1 Ep 1",
        order: 1,
        createdAt: new Date(Date.now() - 5000),
        updatedAt: new Date(),
      })
      .returning();

    const [ep2Part1] = await db
      .insert(episodes)
      .values({
        id: crypto.randomUUID(),
        seasonId: seasonPart1.id,
        sourceUrl: "https://otakudesu.blog/episode/aot-p1-ep2",
        source: "otakudesu",
        title: "AoT P1 Ep 2",
        order: 2,
        createdAt: new Date(Date.now() - 4000),
        updatedAt: new Date(),
      })
      .returning();

    // 4. Create episodes in Part 2 (episodes order overlapping: 1, 2)
    const [ep1Part2] = await db
      .insert(episodes)
      .values({
        id: crypto.randomUUID(),
        seasonId: seasonPart2.id,
        sourceUrl: "https://otakudesu.blog/episode/aot-p2-ep1",
        source: "otakudesu",
        title: "AoT P2 Ep 1",
        order: 1,
        createdAt: new Date(Date.now() - 3000),
        updatedAt: new Date(),
      })
      .returning();

    const [ep2Part2] = await db
      .insert(episodes)
      .values({
        id: crypto.randomUUID(),
        seasonId: seasonPart2.id,
        sourceUrl: "https://otakudesu.blog/episode/aot-p2-ep2",
        source: "otakudesu",
        title: "AoT P2 Ep 2",
        order: 2,
        createdAt: new Date(Date.now() - 2000),
        updatedAt: new Date(),
      })
      .returning();

    // 5. Create episode in Part 3 (episodes order: 1)
    const [ep1Part3] = await db
      .insert(episodes)
      .values({
        id: crypto.randomUUID(),
        seasonId: seasonPart3.id,
        sourceUrl: "https://otakudesu.blog/episode/aot-p3-ep1",
        source: "otakudesu",
        title: "AoT P3 Ep 1",
        order: 1,
        createdAt: new Date(Date.now() - 1000),
        updatedAt: new Date(),
      })
      .returning();

    // Perform merge ordering Part 1 -> Part 2 -> Part 3
    const result = await request(app, {
      method: "POST",
      path: `/series/${targetSeries.id}/seasons/merge`,
      headers,
      body: {
        orderedSeasonIds: [seasonPart1.id, seasonPart2.id, seasonPart3.id],
      },
    });

    expect(result.status).toBe(200);
    expect((result.body as any).data).toEqual({ success: true });

    // Verify duplicate seasons deleted
    const remainingSeasons = await db
      .select()
      .from(seasons)
      .where(eq(seasons.seriesId, targetSeries.id));

    expect(remainingSeasons).toHaveLength(1);
    expect(remainingSeasons[0].id).toBe(seasonPart1.id);

    // Verify episodes updated
    const updatedEpisodes = await db
      .select()
      .from(episodes)
      .where(inArray(episodes.id, [ep1Part1.id, ep2Part1.id, ep1Part2.id, ep2Part2.id, ep1Part3.id]))
      .orderBy(episodes.order);

    expect(updatedEpisodes).toHaveLength(5);

    // All episodes should belong to seasonPart1.id
    for (const ep of updatedEpisodes) {
      expect(ep.seasonId).toBe(seasonPart1.id);
    }

    // Orders should be sequential 1, 2, 3, 4, 5
    expect(updatedEpisodes.map((e) => ({ id: e.id, order: e.order }))).toEqual([
      { id: ep1Part1.id, order: 1 },
      { id: ep2Part1.id, order: 2 },
      { id: ep1Part2.id, order: 3 },
      { id: ep2Part2.id, order: 4 },
      { id: ep1Part3.id, order: 5 },
    ]);
  });
});
