import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series, videoSources } from "@repo/db";
import { createMediaService } from "@repo/media-service";
import { db } from "../../utils/db";

describe("createMediaService saveMedia", () => {
  const service = createMediaService(db);

  beforeEach(async () => {
    await db.delete(videoSources);
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("saves an episode with multiple video sources in a single transaction", async () => {
    const episodeInput = {
      sourceUrl: "https://otakudesu.blog/episode/save-media-unit-1/",
      source: "otakudesu" as const,
      title: "Unit Test Episode 1",
      videoType: "TV",
      videoSources: [
        {
          type: "embed" as const,
          url: "https://odvidhide.com/embed/test1",
          label: "Server Embed",
          quality: "720p",
        },
        {
          type: "direct" as const,
          url: "https://stream.example.com/direct1.mp4",
          label: "Server Direct",
          quality: "1080p",
        },
      ],
      metadata: { episodeNumber: 1 },
    };

    const result = await service.saveMedia({
      episode: episodeInput,
      series: null,
    });

    expect(result.episode).toBeDefined();
    expect(result.episode.id).toBeTypeOf("string");
    expect(result.episode.title).toBe(episodeInput.title);
    expect(result.episode.seasonId).not.toBeNull();
    expect(result.series).not.toBeNull();
    expect(result.series?.tmdbSyncStatus).toBe("PENDING");
    expect(result.series?.title).toBe(episodeInput.title);

    // Verify season and series stub rows in DB
    const seasonRows = await db
      .select()
      .from(seasons)
      .where(eq(seasons.sourceUrl, episodeInput.sourceUrl));
    expect(seasonRows).toHaveLength(1);
    expect(seasonRows[0].seriesId).toBe(result.series!.id);

    // Verify episode row in DB
    const epRows = await db
      .select()
      .from(episodes)
      .where(eq(episodes.id, result.episode.id));
    expect(epRows).toHaveLength(1);
    expect(epRows[0].id).toBe(result.episode.id);
    expect(epRows[0].seasonId).toBe(seasonRows[0].id);

    // Verify video sources rows in DB created in transaction
    const vsRows = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.episodeId, result.episode.id));
    expect(vsRows).toHaveLength(2);
    expect(vsRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "embed",
          url: "https://odvidhide.com/embed/test1",
          label: "Server Embed",
          quality: "720p",
        }),
        expect.objectContaining({
          type: "direct",
          url: "https://stream.example.com/direct1.mp4",
          label: "Server Direct",
          quality: "1080p",
        }),
      ])
    );
  });

  it("saves series and episode linked via seasonId when series is provided", async () => {
    const seriesInput = {
      sourceUrl: "https://otakudesu.blog/anime/save-media-unit-series-1/",
      source: "otakudesu" as const,
      title: "Unit Test Series 1",
      description: "A test series description",
      posterUrl: "https://otakudesu.blog/poster.jpg",
    };

    const episodeInput = {
      sourceUrl: "https://otakudesu.blog/episode/save-media-unit-2/",
      source: "otakudesu" as const,
      title: "Unit Test Episode 2",
      videoType: "TV",
      videoSources: [
        {
          type: "embed" as const,
          url: "https://odvidhide.com/embed/test2",
          label: "Server Embed",
        },
      ],
      metadata: { episodeNumber: 2 },
    };

    const result = await service.saveMedia({
      episode: episodeInput,
      series: seriesInput,
    });

    expect(result.series).toBeDefined();
    expect(result.series).not.toBeNull();
    expect(result.series!.id).toBeTypeOf("string");
    expect(result.series!.title).toBe(seriesInput.title);

    expect(result.episode).toBeDefined();
    expect(result.episode.seasonId).not.toBeNull();

    // Verify DB linkage
    const seasonRows = await db
      .select()
      .from(seasons)
      .where(eq(seasons.sourceUrl, seriesInput.sourceUrl));
    expect(seasonRows).toHaveLength(1);
    expect(seasonRows[0].seriesId).toBe(result.series!.id);

    const epRows = await db
      .select()
      .from(episodes)
      .where(eq(episodes.id, result.episode.id));
    expect(epRows).toHaveLength(1);
    expect(epRows[0].seasonId).toBe(seasonRows[0].id);
  });

  it("upserts existing series and episode records when re-submitted", async () => {
    const seriesInput = {
      sourceUrl: "https://otakudesu.blog/anime/save-media-unit-series-upsert/",
      source: "otakudesu" as const,
      title: "Original Series Title",
      description: null,
      posterUrl: null,
    };

    const episodeInput = {
      sourceUrl: "https://otakudesu.blog/episode/save-media-unit-upsert/",
      source: "otakudesu" as const,
      title: "Original Episode Title",
      videoType: null,
      videoSources: [
        {
          type: "embed" as const,
          url: "https://odvidhide.com/embed/old",
          label: "Old Embed",
        },
      ],
      metadata: {},
    };

    // First save
    await service.saveMedia({
      episode: episodeInput,
      series: seriesInput,
    });

    // Update payload
    const updatedSeriesInput = {
      ...seriesInput,
      title: "Updated Series Title",
      description: "New description",
    };

    const updatedEpisodeInput = {
      ...episodeInput,
      title: "Updated Episode Title",
      videoSources: [
        {
          type: "embed" as const,
          url: "https://odvidhide.com/embed/new",
          label: "New Embed",
        },
      ],
    };

    const updatedResult = await service.saveMedia({
      episode: updatedEpisodeInput,
      series: updatedSeriesInput,
    });

    expect(updatedResult.series!.title).toBe("Updated Series Title");
    expect(updatedResult.series!.description).toBe("New description");
    expect(updatedResult.episode.title).toBe("Updated Episode Title");

    const epRows = await db
      .select()
      .from(episodes)
      .where(eq(episodes.id, updatedResult.episode.id));
    expect(epRows).toHaveLength(1);
    expect(epRows[0].title).toBe("Updated Episode Title");
  });
});
