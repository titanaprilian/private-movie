import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";

async function insertSeriesRow(): Promise<{ id: string }> {
  const now = new Date();
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(series)
    .values({
      id,
      title: "Series To Delete",
      description: "Sample Description",
      posterUrl: "https://example.com/poster.jpg",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db.insert(seasons).values({
    id: crypto.randomUUID(),
    seriesId: id,
    sourceUrl: `https://otakudesu.blog/anime/delete-series-${id}/`,
    source: "otakudesu",
    title: "Series To Delete",
    createdAt: now,
    updatedAt: now,
  });

  return row;
}

async function insertEpisodeRow(seriesId: string): Promise<{ id: string }> {
  const now = new Date();
  const [season] = await db.select().from(seasons).where(eq(seasons.seriesId, seriesId));
  const [row] = await db
    .insert(episodes)
    .values({
      id: crypto.randomUUID(),
      title: "Episode in Series",
      videoType: null,
      metadata: {},
      seasonId: season.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

describe("DELETE /series/:id", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const missingId = crypto.randomUUID();

      const response = await request(app, {
        method: "DELETE",
        path: `/series/${missingId}`,
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when authorization token is invalid or expired", async () => {
      const missingId = crypto.randomUUID();

      const invalidTokenResponse = await request(app, {
        method: "DELETE",
        path: `/series/${missingId}`,
        headers: authHeaders("invalid-token-string"),
      });
      expect(invalidTokenResponse.status).toBe(401);

      const expiredToken = signTestToken(
        { sub: "some-user-id" },
        { expiresInSeconds: -3600 }
      );
      const expiredTokenResponse = await request(app, {
        method: "DELETE",
        path: `/series/${missingId}`,
        headers: authHeaders(expiredToken),
      });
      expect(expiredTokenResponse.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 404 when attempting to delete a series that does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const missingId = crypto.randomUUID();

      const response = await request(app, {
        method: "DELETE",
        path: `/series/${missingId}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("SERIES_NOT_FOUND");
    });
  });

  describe("happy path", () => {
    it("hard-deletes the series by UUID and returns 200 with the deleted record", async () => {
      const { accessToken } = await registerUser(app);
      const seriesRow = await insertSeriesRow();

      const response = await request(app, {
        method: "DELETE",
        path: `/series/${seriesRow.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; title: string };
      };
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe(seriesRow.id);
      expect(body.data.title).toBe("Series To Delete");

      const remaining = await db
        .select()
        .from(series)
        .where(eq(series.id, seriesRow.id));
      expect(remaining).toHaveLength(0);
    });

    it("unlinks child episodes when deleting series", async () => {
      const { accessToken } = await registerUser(app);
      const seriesRow = await insertSeriesRow();
      const epRow = await insertEpisodeRow(seriesRow.id);

      const response = await request(app, {
        method: "DELETE",
        path: `/series/${seriesRow.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);

      const remainingSeries = await db
        .select()
        .from(series)
        .where(eq(series.id, seriesRow.id));
      expect(remainingSeries).toHaveLength(0);

      const remainingEpisode = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, epRow.id));
      expect(remainingEpisode).toHaveLength(1);
      expect(remainingEpisode[0].seasonId).toBeNull();
    });
  });
});
