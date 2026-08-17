import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes } from "@repo/db";
import { buildApp, request } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";
import type { App } from "../../utils/app";

const sampleMp4VideoHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-mp4-video.html"),
  "utf8"
);

describe("POST /episodes/:id/resolve", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp({
      fetchHtml: async (url) => {
        if (url === "https://desustream.net/dstream/arcg/?id=sample") {
          return sampleMp4VideoHtml;
        }
        if (url === "https://example.com/no-video") {
          return "<html><body>No video tag</body></html>";
        }
        throw new Error(`Failed to fetch ${url}`);
      },
    });
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const response = await request(app, {
        method: "POST",
        path: "/episodes/00000000-0000-0000-0000-000000000001/resolve",
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when token is invalid", async () => {
      const response = await request(app, {
        method: "POST",
        path: "/episodes/00000000-0000-0000-0000-000000000001/resolve",
        headers: authHeaders("invalid-token"),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("happy path", () => {
    it("fetches embedUrl HTML, extracts videoUrl, updates database, and returns updated episode", async () => {
      const { accessToken } = await registerUser(app);

      // Create an episode with embedUrl in database via save-media
      const saveRes = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          episode: {
            sourceUrl: "https://otakudesu.blog/episode/resolve-test-ep-1/",
            source: "otakudesu",
            title: "Test Episode 1",
            videoType: null,
            embedUrl: "https://desustream.net/dstream/arcg/?id=sample",
            metadata: {},
          },
        },
      });
      expect(saveRes.status).toBe(200);
      const savedEpisode = (saveRes.body as { data: { episode: { id: string } } }).data.episode;

      // Resolve stream
      const resolveRes = await request(app, {
        method: "POST",
        path: `/episodes/${savedEpisode.id}/resolve`,
        headers: authHeaders(accessToken),
      });

      expect(resolveRes.status).toBe(200);
    });
  });

  describe("error handling", () => {
    it("returns 404 when episode ID does not exist", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/episodes/00000000-0000-0000-0000-000000000099/resolve",
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");
    });

    it("returns 400 when episode has no embedUrl", async () => {
      const { accessToken } = await registerUser(app);

      const saveRes = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          episode: {
            sourceUrl: "https://otakudesu.blog/episode/no-embed-ep-1/",
            source: "otakudesu",
            title: "No Embed Episode",
            videoType: null,
            embedUrl: null,
            metadata: {},
          },
        },
      });
      const savedEpisode = (saveRes.body as { data: { episode: { id: string } } }).data.episode;

      const response = await request(app, {
        method: "POST",
        path: `/episodes/${savedEpisode.id}/resolve`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(400);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("MISSING_EMBED_URL");
    });

    it("returns 400 when no video stream can be found on the page or fetch fails", async () => {
      const { accessToken } = await registerUser(app);

      const saveRes = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          episode: {
            sourceUrl: "https://otakudesu.blog/episode/no-video-ep-1/",
            source: "otakudesu",
            title: "No Video Stream Episode",
            videoType: null,
            embedUrl: "https://example.com/no-video",
            metadata: {},
          },
        },
      });
      const savedEpisode = (saveRes.body as { data: { episode: { id: string } } }).data.episode;

      const response = await request(app, {
        method: "POST",
        path: `/episodes/${savedEpisode.id}/resolve`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(400);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("STREAM_NOT_FOUND");
    });
  });
});
