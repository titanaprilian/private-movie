import crypto from "node:crypto";
import { describe, expect, it, beforeAll } from "vitest";
import { episodes, seasons, series, videoSources } from "@repo/db";
import { eq } from "drizzle-orm";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";

describe("POST /series/:id/bulk-sources", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    const user = await registerUser(app, {
      email: "bulk-sources-save-tester@example.com",
      password: "password123",
      name: "Bulk Sources Save Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  async function createSeriesWithEpisodes(title: string, episodeOrders: number[]) {
    const seriesId = crypto.randomUUID();
    const now = new Date();
    await db.insert(series).values({
      id: seriesId,
      title,
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });

    const seasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: seasonId,
      seriesId,
      title: "Season 1",
      seasonNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    const createdEpisodes: Array<{ id: string; order: number; title: string }> = [];
    for (const order of episodeOrders) {
      const epId = crypto.randomUUID();
      const epTitle = `Episode ${order}`;
      await db.insert(episodes).values({
        id: epId,
        title: epTitle,
        order,
        seasonId,
        createdAt: now,
        updatedAt: now,
      });
      createdEpisodes.push({ id: epId, order, title: epTitle });
    }

    return { seriesId, seasonId, episodes: createdEpisodes };
  }

  it("returns 401 when authorization header is missing", async () => {
    const res = await request(app, {
      method: "POST",
      path: `/series/${crypto.randomUUID()}/bulk-sources`,
      body: {
        mappings: [],
      },
    });

    expect(res.status).toBe(401);
  });

  it("returns 404 when series does not exist in DB", async () => {
    const nonExistentId = crypto.randomUUID();
    const res = await request(app, {
      method: "POST",
      path: `/series/${nonExistentId}/bulk-sources`,
      headers,
      body: {
        mappings: [
          {
            episodeId: crypto.randomUUID(),
            videoSources: [
              {
                type: "embed",
                url: "https://example.com/embed/1",
                label: "720p Embed",
              },
            ],
          },
        ],
      },
    });

    expect(res.status).toBe(404);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe("SERIES_NOT_FOUND");
  });

  it("saves video sources for valid episode mappings and ignores items where episodeId is null", async () => {
    const { seriesId, episodes: createdEps } = await createSeriesWithEpisodes(
      "Bulk Save Series",
      [1, 2, 3]
    );

    const ep1 = createdEps[0];
    const ep2 = createdEps[1];

    const res = await request(app, {
      method: "POST",
      path: `/series/${seriesId}/bulk-sources`,
      headers,
      body: {
        mappings: [
          {
            episodeId: ep1.id,
            videoSources: [
              {
                type: "embed",
                url: "https://example.com/embed/ep1",
                label: "720p HD",
                quality: "720p",
              },
              {
                type: "direct",
                url: "https://example.com/direct/ep1.mp4",
                label: "1080p Direct",
                quality: "1080p",
              },
            ],
          },
          {
            episodeId: null, // Ignored token / skipped episode
            videoSources: [
              {
                type: "embed",
                url: "https://example.com/embed/skipped",
                label: "Skipped",
              },
            ],
          },
          {
            episodeId: ep2.id,
            videoSources: [
              {
                type: "embed",
                url: "https://example.com/embed/ep2",
                label: "720p HD",
              },
            ],
          },
        ],
      },
    });

    expect(res.status).toBe(200);
    const body = res.body as {
      data: {
        success: boolean;
        savedCount: number;
        skippedCount: number;
      };
    };

    expect(body.data).toEqual({
      success: true,
      savedCount: 2,
      skippedCount: 1,
    });

    // Verify DB state for ep1
    const ep1Sources = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.episodeId, ep1.id));
    expect(ep1Sources.length).toBe(2);
    expect(ep1Sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          episodeId: ep1.id,
          type: "embed",
          url: "https://example.com/embed/ep1",
          label: "720p HD",
          quality: "720p",
        }),
        expect.objectContaining({
          episodeId: ep1.id,
          type: "direct",
          url: "https://example.com/direct/ep1.mp4",
          label: "1080p Direct",
          quality: "1080p",
        }),
      ])
    );

    // Verify DB state for ep2
    const ep2Sources = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.episodeId, ep2.id));
    expect(ep2Sources.length).toBe(1);
    expect(ep2Sources[0]).toMatchObject({
      episodeId: ep2.id,
      type: "embed",
      url: "https://example.com/embed/ep2",
      label: "720p HD",
    });

    // Verify DB state for ep3 (unmapped in request, no sources)
    const ep3Sources = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.episodeId, createdEps[2].id));
    expect(ep3Sources.length).toBe(0);
  });
});
