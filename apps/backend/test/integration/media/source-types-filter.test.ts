import { describe, expect, it, beforeAll } from "vitest";
import { genres, series, seasons, episodes, videoSources, seriesToGenres } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { db } from "../../utils/db";

type HomeFeedBody = {
  data: {
    hero: { id: string; title: string } | null;
    rows: Array<{ title: string; items: Array<{ id: string; title: string }> }>;
  };
};

type SeriesDetailsBody = {
  data: {
    id: string;
    seasons: Array<{
      id: string;
      episodes: Array<{
        id: string;
        videoSources: Array<{ id: string; type: string; url: string }>;
      }>;
    }>;
    episodes: Array<{
      id: string;
      videoSources: Array<{ id: string; type: string; url: string }>;
    }>;
  };
};

describe("sourceTypes filtering on home feed and series details", () => {
  let app: App;
  let nativeSeriesId: string;
  let embedOnlySeriesId: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  async function seed(): Promise<void> {
    const now = new Date();
    const older = new Date(now.getTime() - 100000);

    const kdGenreId = crypto.randomUUID();
    await db.insert(genres).values({
      id: kdGenreId,
      name: "Korean Drama",
      slug: "korean-drama",
      createdAt: now,
      updatedAt: now,
    });

    // Native series: featured (older) with direct + s3 + embed sources.
    nativeSeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: nativeSeriesId,
      title: "Native Series",
      description: "Has direct and s3 sources",
      type: "tv",
      isFeatured: true,
      createdAt: older,
      updatedAt: older,
    });
    await db.insert(seriesToGenres).values({
      seriesId: nativeSeriesId,
      genreId: kdGenreId,
    });
    const nativeSeasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: nativeSeasonId,
      seriesId: nativeSeriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "ongoing",
      createdAt: older,
      updatedAt: older,
    });
    const nativeEpId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: nativeEpId,
      title: "Episode 1",
      order: 1,
      seasonId: nativeSeasonId,
      createdAt: older,
      updatedAt: older,
    });
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: nativeEpId,
      type: "direct",
      url: "https://cdn.example.com/native.m3u8",
      label: "Direct",
      createdAt: older,
      updatedAt: older,
    });
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: nativeEpId,
      type: "s3",
      url: "episodes/native-episode/video.mp4",
      label: "S3",
      createdAt: older,
      updatedAt: older,
    });
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: nativeEpId,
      type: "embed",
      url: "https://thirdparty.com/embed/native",
      label: "Embed",
      createdAt: older,
      updatedAt: older,
    });

    // Embed-only series: featured (newest, so it wins the hero slot
    // when unfiltered) with only an embed source.
    embedOnlySeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: embedOnlySeriesId,
      title: "Embed Only Series",
      description: "Only embed sources",
      type: "tv",
      isFeatured: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(seriesToGenres).values({
      seriesId: embedOnlySeriesId,
      genreId: kdGenreId,
    });
    const embedSeasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: embedSeasonId,
      seriesId: embedOnlySeriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "ongoing",
      createdAt: now,
      updatedAt: now,
    });
    const embedEpId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: embedEpId,
      title: "Episode 1",
      order: 1,
      seasonId: embedSeasonId,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: embedEpId,
      type: "embed",
      url: "https://thirdparty.com/embed/only",
      label: "Embed",
      createdAt: now,
      updatedAt: now,
    });
  }

  it("filters hero and all rows to matching series when sourceTypes is supplied", async () => {
    await seed();

    const response = await request(app, {
      path: "/series/home-feed?sourceTypes=direct,s3",
    });

    expect(response.status).toBe(200);
    const body = response.body as HomeFeedBody;

    expect(body.data.hero).not.toBeNull();
    expect(body.data.hero?.id).toBe(nativeSeriesId);

    expect(body.data.rows).toHaveLength(3);
    for (const row of body.data.rows) {
      const ids = row.items.map((i) => i.id);
      expect(ids).toContain(nativeSeriesId);
      expect(ids).not.toContain(embedOnlySeriesId);
    }
  });

  it("supports repeated array-style sourceTypes parameters", async () => {
    await seed();

    const response = await request(app, {
      path: "/series/home-feed?sourceTypes=direct&sourceTypes=s3",
    });

    expect(response.status).toBe(200);
    const body = response.body as HomeFeedBody;

    expect(body.data.hero?.id).toBe(nativeSeriesId);
    for (const row of body.data.rows) {
      const ids = row.items.map((i) => i.id);
      expect(ids).toContain(nativeSeriesId);
      expect(ids).not.toContain(embedOnlySeriesId);
    }
  });

  it("returns all series when sourceTypes is omitted (backward compatible)", async () => {
    await seed();

    const response = await request(app, { path: "/series/home-feed" });

    expect(response.status).toBe(200);
    const body = response.body as HomeFeedBody;

    // The newest featured series (embed-only) wins the hero slot.
    expect(body.data.hero?.id).toBe(embedOnlySeriesId);

    expect(body.data.rows).toHaveLength(3);
    for (const row of body.data.rows) {
      const ids = row.items.map((i) => i.id);
      expect(ids).toContain(nativeSeriesId);
      expect(ids).toContain(embedOnlySeriesId);
    }
  });

  it("filters episode video sources to matching types on series details", async () => {
    await seed();

    const response = await request(app, {
      path: `/series/${nativeSeriesId}?sourceTypes=direct,s3`,
    });

    expect(response.status).toBe(200);
    const body = response.body as SeriesDetailsBody;

    const allSources = [
      ...body.data.episodes.flatMap((e) => e.videoSources),
      ...body.data.seasons.flatMap((s) =>
        s.episodes.flatMap((e) => e.videoSources)
      ),
    ];
    expect(allSources.length).toBeGreaterThan(0);
    for (const source of allSources) {
      expect(["direct", "s3"]).toContain(source.type);
    }
    const types = new Set(allSources.map((s) => s.type));
    expect(types.has("direct")).toBe(true);
    expect(types.has("s3")).toBe(true);
  });

  it("returns all video sources on series details when sourceTypes is omitted", async () => {
    await seed();

    const response = await request(app, {
      path: `/series/${nativeSeriesId}`,
    });

    expect(response.status).toBe(200);
    const body = response.body as SeriesDetailsBody;

    const types = new Set(
      body.data.episodes.flatMap((e) => e.videoSources.map((s) => s.type))
    );
    expect(types.has("direct")).toBe(true);
    expect(types.has("s3")).toBe(true);
    expect(types.has("embed")).toBe(true);
  });
});
