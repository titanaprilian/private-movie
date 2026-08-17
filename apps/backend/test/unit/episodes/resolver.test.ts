import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, videoSources } from "@repo/db";
import { createMediaService, MissingEmbedUrlError, StreamNotFoundError } from "@/modules/media";
import { extractVideoStream } from "@/modules/media/internal/episodes/resolver";
import { db } from "../../utils/db";

const sampleMp4VideoHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-mp4-video.html"),
  "utf8"
);

describe("extractVideoStream", () => {
  it("extracts .mp4 URL from sample-mp4-video.html fixture", () => {
    const videoUrl = extractVideoStream(sampleMp4VideoHtml);
    expect(videoUrl).toBe(
      "https://archive.org/download/diri-dari-skenario-yang-telah-ia-program-sendiri.dwa/Otakudesu.io_TSTJ--01_720p.mp4"
    );
  });

  it("extracts video src from <video src='...'> tag", () => {
    const html = `<div><video src="https://example.com/video.mp4"></video></div>`;
    expect(extractVideoStream(html)).toBe("https://example.com/video.mp4");
  });

  it("extracts source src from <video><source src='...'></video> tag", () => {
    const html = `<div><video><source src="https://example.com/stream.m3u8" type="application/x-mpegURL"></video></div>`;
    expect(extractVideoStream(html)).toBe("https://example.com/stream.m3u8");
  });

  it("extracts source src from standalone <source src='...'> tag", () => {
    const html = `<div><source src="https://example.com/movie.mp4"></source></div>`;
    expect(extractVideoStream(html)).toBe("https://example.com/movie.mp4");
  });

  it("returns null when no video stream exists in HTML", () => {
    const html = `<div><p>No video here</p></div>`;
    expect(extractVideoStream(html)).toBeNull();
  });

  it("returns null when HTML is empty", () => {
    expect(extractVideoStream("")).toBeNull();
  });
});

describe("resolveEpisode service unit", () => {
  beforeEach(async () => {
    await db.delete(videoSources);
    await db.delete(episodes);
  });

  it("processes all embed sources and creates corresponding direct sources", async () => {
    const service = createMediaService(db, {
      fetchHtml: async (url) => {
        if (url === "https://embed.example.com/1") {
          return `<video src="https://stream.example.com/direct1.mp4"></video>`;
        }
        if (url === "https://embed.example.com/2") {
          return `<video src="https://stream.example.com/direct2.mp4"></video>`;
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    const saved = await service.saveMedia({
      episode: {
        sourceUrl: "https://otakudesu.blog/episode/resolve-unit-1/",
        source: "otakudesu",
        title: "Resolve Ep 1",
        videoSources: [
          { type: "embed", url: "https://embed.example.com/1", label: "Server 1", quality: "720p" },
          { type: "embed", url: "https://embed.example.com/2", label: "Server 2", quality: "1080p" },
        ],
        metadata: {},
      },
    });

    const ep = await service.resolveEpisode(saved.episode.id);
    expect(ep.id).toBe(saved.episode.id);

    const sources = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.episodeId, saved.episode.id));

    const directSources = sources.filter((s) => s.type === "direct");
    expect(directSources).toHaveLength(2);
    expect(directSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://stream.example.com/direct1.mp4",
          label: "Server 1 (Direct)",
          quality: "720p",
        }),
        expect.objectContaining({
          url: "https://stream.example.com/direct2.mp4",
          label: "Server 2 (Direct)",
          quality: "1080p",
        }),
      ])
    );
  });

  it("throws MissingEmbedUrlError when episode has no embed sources", async () => {
    const service = createMediaService(db);

    const saved = await service.saveMedia({
      episode: {
        sourceUrl: "https://otakudesu.blog/episode/resolve-unit-no-embed/",
        source: "otakudesu",
        title: "Resolve Ep No Embed",
        videoSources: [
          { type: "direct", url: "https://stream.example.com/direct.mp4", label: "Direct Only" },
        ],
        metadata: {},
      },
    });

    await expect(service.resolveEpisode(saved.episode.id)).rejects.toThrow(
      MissingEmbedUrlError
    );
  });

  it("throws StreamNotFoundError when all embed sources fail resolution", async () => {
    const service = createMediaService(db, {
      fetchHtml: async () => `<html><body>No video tag</body></html>`,
    });

    const saved = await service.saveMedia({
      episode: {
        sourceUrl: "https://otakudesu.blog/episode/resolve-unit-fail/",
        source: "otakudesu",
        title: "Resolve Ep Fail",
        videoSources: [
          { type: "embed", url: "https://embed.example.com/fail", label: "Server Fail" },
        ],
        metadata: {},
      },
    });

    await expect(service.resolveEpisode(saved.episode.id)).rejects.toThrow(
      StreamNotFoundError
    );
  });
});
