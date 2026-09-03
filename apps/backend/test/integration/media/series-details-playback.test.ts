import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import { episodes, seasons, series, videoSources } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { db, truncateAll } from "../../utils/db";

describe("Public series contract playback target normalization (HTTP Integration)", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("normalizes videobello embed URLs and distinguishes direct vs embed playback targets in GET /api/series/:id", async () => {
    const now = new Date();
    const seriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: seriesId,
      title: "Playback Contract Series",
      description: "Series with mixed playback targets",
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

    // 1. Videobello embed source in database with raw provider URL
    const videobelloSourceId = crypto.randomUUID();
    await db.insert(videoSources).values({
      id: videobelloSourceId,
      episodeId,
      type: "embed",
      url: "https://videobello.net/embed/ZXBpc29kZToxMDM4Nw.00000000?source=0",
      label: "BelloCloud",
      createdAt: now,
      updatedAt: now,
    });

    // 2. Direct playback target (native player)
    const directSourceId = crypto.randomUUID();
    await db.insert(videoSources).values({
      id: directSourceId,
      episodeId,
      type: "direct",
      url: "https://cdn.example.com/stream/ep1.m3u8",
      label: "Direct HLS",
      quality: "1080p",
      createdAt: new Date(now.getTime() + 1000),
      updatedAt: new Date(now.getTime() + 1000),
    });

    // 3. Other third-party embed target (WebView player)
    const otherEmbedSourceId = crypto.randomUUID();
    await db.insert(videoSources).values({
      id: otherEmbedSourceId,
      episodeId,
      type: "embed",
      url: "https://thirdparty.com/embed/ep1",
      label: "ThirdParty Embed",
      createdAt: new Date(now.getTime() + 2000),
      updatedAt: new Date(now.getTime() + 2000),
    });

    const response = await request(app, { path: `/series/${seriesId}` });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        id: string;
        seasons: Array<{
          id: string;
          episodes: Array<{
            id: string;
            videoSources: Array<{
              id: string;
              type: string;
              url: string;
              label: string;
            }>;
          }>;
        }>;
      };
    };

    const returnedSources = body.data.seasons[0].episodes[0].videoSources;
    expect(returnedSources).toHaveLength(3);

    // Videobello URL must be normalized to client-consumable /embed/{hash} path
    const returnedVideobello = returnedSources.find((s) => s.id === videobelloSourceId);
    expect(returnedVideobello).toBeDefined();
    expect(returnedVideobello?.type).toBe("embed");
    expect(returnedVideobello?.url).toBe("/embed/ZXBpc29kZToxMDM4Nw.00000000?source=0");

    // Direct playback target must preserve type "direct" and raw stream URL for native renderer
    const returnedDirect = returnedSources.find((s) => s.id === directSourceId);
    expect(returnedDirect).toBeDefined();
    expect(returnedDirect?.type).toBe("direct");
    expect(returnedDirect?.url).toBe("https://cdn.example.com/stream/ep1.m3u8");

    // Other embed target preserves type "embed" and iframe URL for WebView renderer
    const returnedOtherEmbed = returnedSources.find((s) => s.id === otherEmbedSourceId);
    expect(returnedOtherEmbed).toBeDefined();
    expect(returnedOtherEmbed?.type).toBe("embed");
    expect(returnedOtherEmbed?.url).toBe("https://thirdparty.com/embed/ep1");
  });

  it("normalizes playback targets in GET /api/episodes/:id", async () => {
    const now = new Date();
    const seriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: seriesId,
      title: "Episode Playback Series",
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

    const episodeId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: episodeId,
      title: "Episode Details Test",
      order: 1,
      seasonId,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId,
      type: "embed",
      url: "https://videobello.net/embed/hash999?foo=bar",
      label: "BelloCloud",
      createdAt: now,
      updatedAt: now,
    });

    const response = await request(app, { path: `/episodes/${episodeId}` });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        id: string;
        videoSources: Array<{ type: string; url: string }>;
      };
    };

    expect(body.data.id).toBe(episodeId);
    expect(body.data.videoSources[0].type).toBe("embed");
    expect(body.data.videoSources[0].url).toBe("/embed/hash999?foo=bar");
  });
});
