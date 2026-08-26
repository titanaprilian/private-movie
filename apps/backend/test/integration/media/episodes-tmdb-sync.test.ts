import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { createDbClient, episodes, seasons, series } from "@repo/db";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

const db = createDbClient(process.env.DATABASE_URL);

describe("Season Episode TMDB Sync API", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    process.env.TMDB_API_KEY = "test-tmdb-key";
    app = await buildApp();
    const user = await registerUser(app, {
      email: "episodes-tmdb-tester@example.com",
      password: "password123",
      name: "Episode TMDB Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /seasons/:id/episodes/tmdb-preview", () => {
    it("returns 404 when season is not found", async () => {
      const nonexistentId = crypto.randomUUID();
      const reqOptions = {
        method: "GET",
        path: `/seasons/${nonexistentId}/episodes/tmdb-preview`,
        headers,
      };

      const result = await request(app, reqOptions);
      expect(result.status).toBe(404);
      expect((result.body as any).error.code).toBe("SEASON_NOT_FOUND");
    });

    it("returns 400 when season is not linked to TMDB and no query params provided", async () => {
      const [seriesRecord] = await db
        .insert(series)
        .values({
          id: crypto.randomUUID(),
          title: "Unlinked Series",
          type: "tv",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const [seasonRecord] = await db
        .insert(seasons)
        .values({
          id: crypto.randomUUID(),
          seriesId: seriesRecord.id,
          sourceUrl: "https://otakudesu.blog/anime/unlinked-s1",
          source: "otakudesu",
          title: "Season 1 Unlinked",
          tmdbId: null,
          tmdbSeason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const reqOptions = {
        method: "GET",
        path: `/seasons/${seasonRecord.id}/episodes/tmdb-preview`,
        headers,
      };

      const result = await request(app, reqOptions);
      expect(result.status).toBe(400);
      expect((result.body as any).error.code).toBe("SEASON_NOT_LINKED_TO_TMDB");
    });

    it("returns accurate preview payload with updates, inserts, and unmapped episodes", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = input.toString();
        if (url.includes("/tv/100/season/1")) {
          return new Response(
            JSON.stringify({
              id: 100,
              season_number: 1,
              episodes: [
                {
                  id: 1001,
                  episode_number: 1,
                  name: "Clean Episode 1 Title",
                  overview: "TMDB Episode 1 description",
                  still_path: "/ep1_still.jpg",
                  vote_average: 8.5,
                  runtime: 24,
                  air_date: "2024-01-10",
                },
                {
                  id: 1002,
                  episode_number: 2,
                  name: "Clean Episode 2 Title",
                  overview: "TMDB Episode 2 description",
                  still_path: "/ep2_still.jpg",
                  vote_average: 9.0,
                  runtime: 24,
                  air_date: "2024-01-17",
                },
              ],
            }),
            { status: 200 }
          );
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const [seriesRecord] = await db
        .insert(series)
        .values({
          id: crypto.randomUUID(),
          title: "Series 100",
          type: "tv",
          tmdbId: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const [seasonRecord] = await db
        .insert(seasons)
        .values({
          id: crypto.randomUUID(),
          seriesId: seriesRecord.id,
          sourceUrl: "https://otakudesu.blog/anime/series-100-s1",
          source: "otakudesu",
          title: "Season 1",
          tmdbId: 100,
          tmdbSeason: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Local ep 1 (matches TMDB ep 1 by order)
      const [ep1] = await db
        .insert(episodes)
        .values({
          id: crypto.randomUUID(),
          seasonId: seasonRecord.id,
          order: 1,
          title: "Messy Scraped Title Ep 1",
          description: "Old local desc",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Local ep 3 (unmapped stray OVA)
      const [ep3] = await db
        .insert(episodes)
        .values({
          id: crypto.randomUUID(),
          seasonId: seasonRecord.id,
          order: 3,
          title: "Stray OVA Special",
          description: "Custom OVA desc",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const reqOptions = {
        method: "GET",
        path: `/seasons/${seasonRecord.id}/episodes/tmdb-preview`,
        headers,
      };

      const result = await request(app, reqOptions);
      expect(result.status).toBe(200);

      const data = (result.body as any).data;
      expect(data.seasonId).toBe(seasonRecord.id);
      expect(data.tmdbId).toBe(100);
      expect(data.tmdbSeason).toBe(1);

      // Updates (order 1)
      expect(data.updates).toHaveLength(1);
      expect(data.updates[0].id).toBe(ep1.id);
      expect(data.updates[0].order).toBe(1);
      expect(data.updates[0].existingTitle).toBe("Messy Scraped Title Ep 1");
      expect(data.updates[0].newTitle).toBe("Clean Episode 1 Title");
      expect(data.updates[0].newDescription).toBe("TMDB Episode 1 description");
      expect(data.updates[0].newThumbnailUrl).toBe("https://image.tmdb.org/t/p/w500/ep1_still.jpg");
      expect(data.updates[0].tmdbId).toBe(1001);

      // Inserts (order 2)
      expect(data.inserts).toHaveLength(1);
      expect(data.inserts[0].order).toBe(2);
      expect(data.inserts[0].title).toBe("Clean Episode 2 Title");
      expect(data.inserts[0].description).toBe("TMDB Episode 2 description");
      expect(data.inserts[0].tmdbId).toBe(1002);

      // Unmapped (order 3)
      expect(data.unmapped).toHaveLength(1);
      expect(data.unmapped[0].id).toBe(ep3.id);
      expect(data.unmapped[0].order).toBe(3);
      expect(data.unmapped[0].title).toBe("Stray OVA Special");
    });
  });

  describe("POST /seasons/:id/episodes/tmdb-sync", () => {
    it("returns 401 when authorization header is missing", async () => {
      const reqOptions = {
        method: "POST",
        path: `/seasons/${crypto.randomUUID()}/episodes/tmdb-sync`,
      };

      const result = await request(app, reqOptions);
      expect(result.status).toBe(401);
    });

    it("returns 404 when season is not found", async () => {
      const nonexistentId = crypto.randomUUID();
      const reqOptions = {
        method: "POST",
        path: `/seasons/${nonexistentId}/episodes/tmdb-sync`,
        headers,
      };

      const result = await request(app, reqOptions);
      expect(result.status).toBe(404);
      expect((result.body as any).error.code).toBe("SEASON_NOT_FOUND");
    });

    it("executes database mutations: updates matching episodes, creates stubs, leaves unmapped untouched", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = input.toString();
        if (url.includes("/tv/200/season/1")) {
          return new Response(
            JSON.stringify({
              id: 200,
              season_number: 1,
              episodes: [
                {
                  id: 2001,
                  episode_number: 1,
                  name: "TMDB Episode 1",
                  overview: "New description 1",
                  still_path: "/thumb1.jpg",
                  vote_average: 8.8,
                  runtime: 25,
                  air_date: "2024-02-01",
                },
                {
                  id: 2002,
                  episode_number: 2,
                  name: "TMDB Episode 2 (Stub)",
                  overview: "New description 2",
                  still_path: "/thumb2.jpg",
                  vote_average: 8.9,
                  runtime: 25,
                  air_date: "2024-02-08",
                },
              ],
            }),
            { status: 200 }
          );
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const [seriesRecord] = await db
        .insert(series)
        .values({
          id: crypto.randomUUID(),
          title: "Series 200",
          type: "tv",
          tmdbId: 200,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const [seasonRecord] = await db
        .insert(seasons)
        .values({
          id: crypto.randomUUID(),
          seriesId: seriesRecord.id,
          sourceUrl: "https://otakudesu.blog/anime/series-200-s1",
          source: "otakudesu",
          title: "Season 1",
          tmdbId: 200,
          tmdbSeason: 1,
          tmdbSyncStatus: "PENDING",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Order 1 (matching)
      const [localEp1] = await db
        .insert(episodes)
        .values({
          id: crypto.randomUUID(),
          seasonId: seasonRecord.id,
          order: 1,
          title: "Old Scraped Title Ep 1",
          description: "Old description 1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Order 5 (unmapped stray episode)
      const [localEp5] = await db
        .insert(episodes)
        .values({
          id: crypto.randomUUID(),
          seasonId: seasonRecord.id,
          order: 5,
          title: "Stray OVA Ep 5",
          description: "Stray description",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const reqOptions = {
        method: "POST",
        path: `/seasons/${seasonRecord.id}/episodes/tmdb-sync`,
        headers,
      };

      const result = await request(app, reqOptions);
      expect(result.status).toBe(200);

      const resBody = (result.body as any).data;
      expect(resBody.success).toBe(true);
      expect(resBody.updatedCount).toBe(1);
      expect(resBody.insertedCount).toBe(1);
      expect(resBody.unmappedCount).toBe(1);

      // Verify DB: ep 1 updated
      const [updatedEp1] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, localEp1.id));
      expect(updatedEp1.title).toBe("TMDB Episode 1");
      expect(updatedEp1.description).toBe("New description 1");
      expect(updatedEp1.thumbnailUrl).toBe("https://image.tmdb.org/t/p/w500/thumb1.jpg");
      expect(updatedEp1.rating).toBe("8.8");
      expect(updatedEp1.duration).toBe(25);
      expect(updatedEp1.tmdbId).toBe(2001);

      // Verify DB: ep 2 inserted
      const [insertedEp2] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.order, 2));
      expect(insertedEp2).toBeDefined();
      expect(insertedEp2.seasonId).toBe(seasonRecord.id);
      expect(insertedEp2.title).toBe("TMDB Episode 2 (Stub)");
      expect(insertedEp2.description).toBe("New description 2");
      expect(insertedEp2.tmdbId).toBe(2002);

      // Verify DB: ep 5 untouched
      const [untouchedEp5] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, localEp5.id));
      expect(untouchedEp5.title).toBe("Stray OVA Ep 5");
      expect(untouchedEp5.description).toBe("Stray description");

      // Verify season sync status
      const [updatedSeason] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.id, seasonRecord.id));
      expect(updatedSeason.tmdbSyncStatus).toBe("SYNCED");
    });
  });
});
