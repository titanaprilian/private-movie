import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";

async function insertTestSeries(): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(series).values({
    id,
    title: "Order Test Series",
    description: "Description",
    posterUrl: "https://example.com/poster.jpg",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(seasons).values({
    id: crypto.randomUUID(),
    seriesId: id,
    sourceUrl: `https://otakudesu.blog/anime/series-order-test-${id}/`,
    source: "otakudesu",
    title: "Order Test Series",
    createdAt: now,
    updatedAt: now,
  });

  return { id };
}

async function insertTestEpisode(seriesId: string, order: number): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const now = new Date();

  const [season] = await db.select().from(seasons).where(eq(seasons.seriesId, seriesId));

  await db.insert(episodes).values({
    id,
    title: `Episode ${order}`,
    order,
    seasonId: season.id,
    createdAt: now,
    updatedAt: now,
  });

  return { id };
}

describe("PATCH /series/:id/episodes/order", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const s = await insertTestSeries();
      const ep1 = await insertTestEpisode(s.id, 1);

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${s.id}/episodes/order`,
        body: [{ id: ep1.id, order: 2 }],
      });

      expect(response.status).toBe(401);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when authorization token is invalid or expired", async () => {
      const s = await insertTestSeries();
      const ep1 = await insertTestEpisode(s.id, 1);

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${s.id}/episodes/order`,
        headers: authHeaders("invalid-token"),
        body: [{ id: ep1.id, order: 2 }],
      });

      expect(response.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 404 when series ID does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const missingSeriesId = crypto.randomUUID();
      const ep1Id = crypto.randomUUID();

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${missingSeriesId}/episodes/order`,
        headers: authHeaders(accessToken),
        body: [{ id: ep1Id, order: 1 }],
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("SERIES_NOT_FOUND");
    });

    it("returns 404 when episode ID in array does not exist and transaction rolls back", async () => {
      const { accessToken } = await registerUser(app);
      const s = await insertTestSeries();
      const ep1 = await insertTestEpisode(s.id, 1);
      const missingEpId = crypto.randomUUID();

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${s.id}/episodes/order`,
        headers: authHeaders(accessToken),
        body: [
          { id: ep1.id, order: 10 },
          { id: missingEpId, order: 20 },
        ],
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");

      const checkEp1 = await db.select().from(episodes).where(eq(episodes.id, ep1.id));
      expect(checkEp1[0].order).toBe(1);
    });
  });

  describe("bulk update functionality", () => {
    it("successfully updates episode orders in bulk", async () => {
      const { accessToken } = await registerUser(app);
      const s = await insertTestSeries();
      const ep1 = await insertTestEpisode(s.id, 1);
      const ep2 = await insertTestEpisode(s.id, 2);
      const ep3 = await insertTestEpisode(s.id, 3);

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${s.id}/episodes/order`,
        headers: authHeaders(accessToken),
        body: [
          { id: ep1.id, order: 3 },
          { id: ep2.id, order: 1 },
          { id: ep3.id, order: 2 },
        ],
      });

      expect(response.status).toBe(200);
      const body = response.body as { data: { success: boolean } };
      expect(body.data).toEqual({ success: true });

      const checkEp1 = await db.select().from(episodes).where(eq(episodes.id, ep1.id));
      const checkEp2 = await db.select().from(episodes).where(eq(episodes.id, ep2.id));
      const checkEp3 = await db.select().from(episodes).where(eq(episodes.id, ep3.id));

      expect(checkEp1[0].order).toBe(3);
      expect(checkEp2[0].order).toBe(1);
      expect(checkEp3[0].order).toBe(2);
    });
  });
});
