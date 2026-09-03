import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import { episodes, seasons, series, videoSources } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { db, truncateAll } from "../../utils/db";

/**
 * Ticket #279 — Wire the end-to-end watch-to-player flow against the real backend.
 *
 * Simulates the Android TV MVP path at the HTTP boundary: the TV home screen
 * loads the public home feed, selecting a series opens series details with
 * episodes and normalized playback targets, and the source picker hands a
 * client-consumable target (direct vs embed) to the player.
 */
describe("Android TV MVP flow: home-feed -> series details -> playback targets (HTTP Integration)", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("walks the full TV MVP journey from home feed to normalized playback targets", async () => {
    const now = new Date();
    const seriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: seriesId,
      title: "TV MVP Series",
      description: "Series browsed on Android TV home",
      type: "tv",
      isFeatured: true,
      createdAt: now,
      updatedAt: now,
    });

    const seasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: seasonId,
      seriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "ongoing",
      createdAt: now,
      updatedAt: now,
    });

    const episodeId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: episodeId,
      title: "Episode 1",
      order: 1,
      seasonId,
      createdAt: now,
      updatedAt: now,
    });

    const videobelloId = crypto.randomUUID();
    await db.insert(videoSources).values({
      id: videobelloId,
      episodeId,
      type: "embed",
      url: "https://videobello.net/embed/TVFlowHash123?source=0",
      label: "BelloCloud",
      createdAt: now,
      updatedAt: now,
    });

    const directId = crypto.randomUUID();
    await db.insert(videoSources).values({
      id: directId,
      episodeId,
      type: "direct",
      url: "https://cdn.example.com/stream/tv-flow.m3u8",
      label: "Direct HLS",
      quality: "1080p",
      createdAt: new Date(now.getTime() + 1000),
      updatedAt: new Date(now.getTime() + 1000),
    });

    // Step 1 (Home): TV home screen loads the public catalog.
    const homeResponse = await request(app, { path: "/series/home-feed" });
    expect(homeResponse.status).toBe(200);
    const homeBody = homeResponse.body as {
      data: {
        hero: { id: string } | null;
        rows: Array<{ title: string; items: Array<{ id: string }> }>;
      };
    };
    expect(homeBody.data.rows.map((row) => row.title)).toEqual([
      "Ongoing",
      "Korean Drama",
      "Recently Added",
    ]);
    const catalogIds = homeBody.data.rows.flatMap((row) =>
      row.items.map((item) => item.id),
    );
    expect(catalogIds).toContain(seriesId);

    // Step 2 (Watch/Detail): selecting the series loads seasons, episodes,
    // and the normalized source list the picker renders.
    const detailResponse = await request(app, { path: `/series/${seriesId}` });
    expect(detailResponse.status).toBe(200);
    const detailBody = detailResponse.body as {
      data: {
        id: string;
        seasons: Array<{
          id: string;
          episodes: Array<{
            id: string;
            videoSources: Array<{ id: string; type: string; url: string; label: string }>;
          }>;
        }>;
      };
    };
    expect(detailBody.data.id).toBe(seriesId);
    const detailSources =
      detailBody.data.seasons[0].episodes[0].videoSources;
    expect(detailSources).toHaveLength(2);

    // Step 3 (Player handoff): normalized targets let the TV client choose
    // the renderer without provider rewrite rules — embed (incl. videobello
    // normalization) goes to WebView, direct goes to the native player.
    const videobello = detailSources.find((s) => s.id === videobelloId);
    expect(videobello?.type).toBe("embed");
    expect(videobello?.url).toBe("/embed/TVFlowHash123?source=0");

    const direct = detailSources.find((s) => s.id === directId);
    expect(direct?.type).toBe("direct");
    expect(direct?.url).toBe("https://cdn.example.com/stream/tv-flow.m3u8");
  });

  it("returns the shared error envelope when the TV detail flow hits a missing series", async () => {
    const missingId = crypto.randomUUID();
    const response = await request(app, { path: `/series/${missingId}` });

    expect(response.status).toBe(404);
    const body = response.body as {
      error: { code: string; message: string };
    };
    // Same envelope the TV detail error state renders with retry + back.
    expect(body.error.code).toBe("SERIES_NOT_FOUND");
    expect(body.error.message).toContain(missingId);
  });
});
