import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { episodes, seasons, series, videoSources } from "@repo/db";
import { eq } from "drizzle-orm";
import { createMediaService, EpisodeFetchError, EpisodeNotFoundError, type FetchFn } from "@repo/media-service";
import { db } from "../../utils/db";

const sampleAHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-a.html"),
  "utf8"
);
const sampleDirectVideoHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-direct-video.html"),
  "utf8"
);
const DESUSTREAM_IFRAME_BASE = "https://desustream.net/dstream/arcg/?id=";
const ODVIDHIDE_EMBED_BASE = "https://odvidhide.com/embed/";
const NONCE_ACTION = "aa1208d27f29ca340c92c66d1926f13f";
const MIRROR_ACTION = "2a3505c93b0035d3f455df82bf976b84";

function buildMockFetchFn(): FetchFn {
  return {
    async get(url) {
      if (url === "https://otakudesu.blog/episode/test-ep-1/") {
        return sampleAHtml;
      }
      if (
        url.startsWith(DESUSTREAM_IFRAME_BASE) ||
        url.startsWith(ODVIDHIDE_EMBED_BASE) ||
        url.startsWith("https://player.example.com")
      ) {
        return sampleDirectVideoHtml;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    },
    async post(_url, body) {
      const params = new URLSearchParams(body);
      const action = params.get("action") ?? "";
      if (action === NONCE_ACTION) {
        return JSON.stringify({ data: "fake-nonce-123" });
      }
      if (action === MIRROR_ACTION) {
        const i = parseInt(params.get("i") ?? "-1", 10);
        const html = `<div id="pembed"><iframe src="https://player.example.com/embed/mirror-${i}" frameborder="0"></iframe></div>`;
        return JSON.stringify({ data: Buffer.from(html).toString("base64") });
      }
      throw new Error(`unknown action: ${action}`);
    },
  };
}

describe("createMediaService scrapeAndSaveSources", () => {
  const service = createMediaService(db, {
    fetchHtml: buildMockFetchFn(),
  });

  beforeEach(async () => {
    await db.delete(videoSources);
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  async function createEpisodeFixture() {
    const seriesId = crypto.randomUUID();
    const seasonId = crypto.randomUUID();
    const episodeId = crypto.randomUUID();
    const now = new Date();

    await db.insert(series).values({
      id: seriesId,
      title: "Test Series",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seasons).values({
      id: seasonId,
      seriesId,
      title: "Season 1",
      seasonNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(episodes).values({
      id: episodeId,
      seasonId,
      title: "Episode 1",
      order: 1,
      createdAt: now,
      updatedAt: now,
    });

    return episodeId;
  }

  it("throws EpisodeNotFoundError if episode does not exist", async () => {
    await expect(
      service.scrapeAndSaveSources(
        "00000000-0000-0000-0000-000000000000",
        "https://otakudesu.blog/episode/ep-1/"
      )
    ).rejects.toThrow(EpisodeNotFoundError);
  });

  it("throws EpisodeFetchError if sourceUrl has no matching provider", async () => {
    const episodeId = await createEpisodeFixture();

    await expect(
      service.scrapeAndSaveSources(episodeId, "https://unknown-provider.com/ep-1/")
    ).rejects.toThrow(EpisodeFetchError);
  });

  it("scrapes sources via resolveVideoSources and upserts video sources into DB", async () => {
    const episodeId = await createEpisodeFixture();

    const result = await service.scrapeAndSaveSources(
      episodeId,
      "https://otakudesu.blog/episode/test-ep-1/"
    );

    expect(result.id).toBe(episodeId);
    expect(result.videoSources).toBeDefined();
    expect(result.videoSources.length).toBeGreaterThan(0);

    const savedVs = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.episodeId, episodeId));
    expect(savedVs.length).toBe(result.videoSources.length);
  });

  it("wipes old video sources for the episode before saving new ones", async () => {
    const episodeId = await createEpisodeFixture();

    // Insert an old video source manually
    const oldVsId = crypto.randomUUID();
    await db.insert(videoSources).values({
      id: oldVsId,
      episodeId,
      type: "embed",
      url: "https://old-source.example.com/embed",
      label: "Old Source",
      quality: "480p",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.scrapeAndSaveSources(
      episodeId,
      "https://otakudesu.blog/episode/test-ep-1/"
    );

    const savedVs = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.episodeId, episodeId));

    const containsOld = savedVs.some((vs) => vs.id === oldVsId);
    expect(containsOld).toBe(false);
    expect(savedVs.length).toBe(result.videoSources.length);
  });

  it("passes browserFn to resolveVideoSources when provided in createMediaService options", async () => {
    const episodeId = await createEpisodeFixture();
    const mockBrowserFn = vi.fn().mockResolvedValue(`
      <html>
        <body>
          <iframe src="https://videobello.example.com/embed/xyz123"></iframe>
        </body>
      </html>
    `);

    const customService = createMediaService(db, {
      fetchHtml: buildMockFetchFn(),
      browserFn: mockBrowserFn,
    });

    const result = await customService.scrapeAndSaveSources(
      episodeId,
      "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1"
    );

    expect(mockBrowserFn).toHaveBeenCalledWith("https://dramula.com/watch/teach-you-a-lesson-2026/s1e1");
    expect(result.videoSources.some((vs) => vs.url.includes("videobello.example.com"))).toBe(true);
  });
});
