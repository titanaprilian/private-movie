import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { describe, expect, it, beforeAll } from "vitest";
import { episodes, seasons, series, videoSources } from "@repo/db";
import { eq } from "drizzle-orm";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
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

describe("POST /episodes/:id/scrape-sources", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp({
      fetchHtml: {
        async get(url) {
          if (url === "https://otakudesu.blog/episode/test-scrape-sources-ep-1/") {
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
      },
    });
    const user = await registerUser(app, {
      email: "scrape-sources-tester@example.com",
      password: "password123",
      name: "Scrape Sources Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  async function createEpisodeFixture() {
    const seriesId = crypto.randomUUID();
    const now = new Date();
    await db.insert(series).values({
      id: seriesId,
      title: "Test Anime Series",
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

    const epId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: epId,
      title: "Episode 1",
      order: 1,
      seasonId,
      createdAt: now,
      updatedAt: now,
    });

    return { seriesId, seasonId, episodeId: epId };
  }

  it("returns 401 when authorization header is missing", async () => {
    const res = await request(app, {
      method: "POST",
      path: `/episodes/${crypto.randomUUID()}/scrape-sources`,
      body: {
        sourceUrl: "https://otakudesu.blog/episode/ep-1/",
      },
    });

    expect(res.status).toBe(401);
  });

  it("returns 404 when episode does not exist", async () => {
    const res = await request(app, {
      method: "POST",
      path: `/episodes/${crypto.randomUUID()}/scrape-sources`,
      headers,
      body: {
        sourceUrl: "https://otakudesu.blog/episode/ep-1/",
      },
    });

    expect(res.status).toBe(404);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe("EPISODE_NOT_FOUND");
  });

  it("returns 400 when sourceUrl is not a valid URI", async () => {
    const { episodeId } = await createEpisodeFixture();
    const res = await request(app, {
      method: "POST",
      path: `/episodes/${episodeId}/scrape-sources`,
      headers,
      body: {
        sourceUrl: "invalid-url",
      },
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when no provider can handle the sourceUrl", async () => {
    const { episodeId } = await createEpisodeFixture();
    const res = await request(app, {
      method: "POST",
      path: `/episodes/${episodeId}/scrape-sources`,
      headers,
      body: {
        sourceUrl: "https://unknownprovider.com/ep-1/",
      },
    });

    expect(res.status).toBe(400);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe("EPISODE_FETCH");
  });

  it("successfully scrapes sources and upserts into DB for valid episode", async () => {
    const { episodeId } = await createEpisodeFixture();
    const res = await request(app, {
      method: "POST",
      path: `/episodes/${episodeId}/scrape-sources`,
      headers,
      body: {
        sourceUrl: "https://otakudesu.blog/episode/test-scrape-sources-ep-1/",
      },
    });

    expect(res.status).toBe(200);
    const body = res.body as { data: { id: string; videoSources: Array<{ id: string }> } };
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe(episodeId);
    expect(Array.isArray(body.data.videoSources)).toBe(true);

    const savedSources = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.episodeId, episodeId));
    expect(savedSources.length).toBe(body.data.videoSources.length);
  });

  it("replaces existing video sources instead of appending when scraped multiple times", async () => {
    const { episodeId } = await createEpisodeFixture();

    // Insert pre-existing dummy video source
    const dummyVsId = crypto.randomUUID();
    await db.insert(videoSources).values({
      id: dummyVsId,
      episodeId,
      type: "embed",
      url: "https://stale-provider.com/embed/123",
      label: "Stale Server",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app, {
      method: "POST",
      path: `/episodes/${episodeId}/scrape-sources`,
      headers,
      body: {
        sourceUrl: "https://otakudesu.blog/episode/test-scrape-sources-ep-1/",
      },
    });

    expect(res.status).toBe(200);
    const body = res.body as { data: { id: string; videoSources: Array<{ id: string; url: string }> } };
    
    const savedSources = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.episodeId, episodeId));

    const containsDummy = savedSources.some((s) => s.id === dummyVsId);
    expect(containsDummy).toBe(false);
    expect(savedSources.length).toBe(body.data.videoSources.length);
  });

  it("confirms deprecated POST /series/:id/bulk-sources route is removed", async () => {
    const res = await request(app, {
      method: "POST",
      path: `/series/${crypto.randomUUID()}/bulk-sources`,
      headers,
      body: {
        mappings: [],
      },
    });

    expect(res.status).toBe(404);
  });
});
