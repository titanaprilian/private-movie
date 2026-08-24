import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import crypto from "node:crypto";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";

const now = new Date();

async function createSeriesWithSeasons(): Promise<{
  seriesId: string;
  season1Id: string;
  season2Id: string;
}> {
  const seriesId = crypto.randomUUID();
  const season1Id = crypto.randomUUID();
  const season2Id = crypto.randomUUID();

  await db.insert(series).values({
    id: seriesId,
    title: "Cross Season Series",
    type: "tv",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(seasons).values([
    {
      id: season1Id,
      seriesId,
      sourceUrl: `https://otakudesu.blog/cross-s1-${seriesId}`,
      source: "otakudesu",
      title: "Season 1",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: season2Id,
      seriesId,
      sourceUrl: `https://otakudesu.blog/cross-s2-${seriesId}`,
      source: "otakudesu",
      title: "Season 2",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  return { seriesId, season1Id, season2Id };
}

async function insertEpisode(
  seasonId: string,
  title: string,
  order: number
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.insert(episodes).values({
    id,
    title,
    order,
    seasonId,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

async function getEpisode(id: string) {
  const [row] = await db.select().from(episodes).where(eq(episodes.id, id));
  return row;
}

describe("PATCH /series/:id/episodes/order — cross-season moves", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("accepts optional seasonId in the payload schema", async () => {
    const { accessToken } = await registerUser(app);
    const { seriesId, season1Id, season2Id } = await createSeriesWithSeasons();
    await insertEpisode(season1Id, "S1 Ep 1", 1);
    const ep2 = await insertEpisode(season2Id, "S2 Ep 1", 1);

    // Move S2 Ep 1 into season 1 at order 2 (no order collision).
    const response = await request(app, {
      method: "PATCH",
      path: `/series/${seriesId}/episodes/order`,
      headers: authHeaders(accessToken),
      body: [{ id: ep2.id, order: 2, seasonId: season1Id }],
    });

    expect(response.status).toBe(200);
    expect((response.body as { data: unknown }).data).toEqual({ success: true });

    const moved = await getEpisode(ep2.id);
    expect(moved.seasonId).toBe(season1Id);
    expect(moved.order).toBe(2);
  });

  it("migrates an episode into a season with a colliding order without violating the unique constraint", async () => {
    const { accessToken } = await registerUser(app);
    const { seriesId, season1Id, season2Id } = await createSeriesWithSeasons();
    const s1ep1 = await insertEpisode(season1Id, "S1 Ep 1", 1);
    const s2ep1 = await insertEpisode(season2Id, "S2 Ep 1", 1);

    // Move S2 Ep 1 into season 1 at order 1 while S1 Ep 1 still occupies
    // (season1, 1) — only the negative-order parking phase makes this safe.
    const response = await request(app, {
      method: "PATCH",
      path: `/series/${seriesId}/episodes/order`,
      headers: authHeaders(accessToken),
      body: [
        { id: s2ep1.id, order: 1, seasonId: season1Id },
        { id: s1ep1.id, order: 2 },
      ],
    });

    expect(response.status).toBe(200);

    const movedIn = await getEpisode(s2ep1.id);
    const shifted = await getEpisode(s1ep1.id);
    expect(movedIn.seasonId).toBe(season1Id);
    expect(movedIn.order).toBe(1);
    expect(shifted.seasonId).toBe(season1Id);
    expect(shifted.order).toBe(2);
  });

  it("swaps two episodes across seasons in a single payload", async () => {
    const { accessToken } = await registerUser(app);
    const { seriesId, season1Id, season2Id } = await createSeriesWithSeasons();
    const a = await insertEpisode(season1Id, "A", 1);
    const b = await insertEpisode(season2Id, "B", 5);

    const response = await request(app, {
      method: "PATCH",
      path: `/series/${seriesId}/episodes/order`,
      headers: authHeaders(accessToken),
      body: [
        { id: a.id, order: 5, seasonId: season2Id },
        { id: b.id, order: 1, seasonId: season1Id },
      ],
    });

    expect(response.status).toBe(200);
    expect((await getEpisode(a.id)).seasonId).toBe(season2Id);
    expect((await getEpisode(a.id)).order).toBe(5);
    expect((await getEpisode(b.id)).seasonId).toBe(season1Id);
    expect((await getEpisode(b.id)).order).toBe(1);
  });

  it("rolls back the whole transaction when an episode is missing", async () => {
    const { accessToken } = await registerUser(app);
    const { seriesId, season1Id, season2Id } = await createSeriesWithSeasons();
    const s1ep1 = await insertEpisode(season1Id, "S1 Ep 1", 1);
    const missingId = crypto.randomUUID();

    const response = await request(app, {
      method: "PATCH",
      path: `/series/${seriesId}/episodes/order`,
      headers: authHeaders(accessToken),
      body: [
        { id: s1ep1.id, order: 3, seasonId: season2Id },
        { id: missingId, order: 4 },
      ],
    });

    expect(response.status).toBe(404);
    expect(
      (response.body as { error: { code: string } }).error.code
    ).toBe("EPISODE_NOT_FOUND");

    const unchanged = await getEpisode(s1ep1.id);
    expect(unchanged.seasonId).toBe(season1Id);
    expect(unchanged.order).toBe(1);
  });
});
