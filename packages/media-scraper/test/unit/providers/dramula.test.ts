import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DramulaProvider,
  MediaScraper,
  NotImplementedError,
  type FetchFn,
} from "../../../src";

const sampleDramulaHtml = fs.readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../fixtures/episodes/sample-dramula.html"
  ),
  "utf8"
);

function buildMockFetchFn(): FetchFn {
  return {
    async get(url: string) {
      if (url === "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1") {
        return sampleDramulaHtml;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    },
    async post() {
      throw new Error("POST not implemented");
    },
  };
}

describe("DramulaProvider", () => {
  const provider = new DramulaProvider();

  describe("canHandle", () => {
    it("returns true for dramula URLs", () => {
      expect(
        provider.canHandle(
          "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1"
        )
      ).toBe(true);
    });

    it("returns false for non-dramula URLs", () => {
      expect(provider.canHandle("https://otakudesu.cloud/anime/something")).toBe(
        false
      );
    });
  });

  describe("registry integration", () => {
    it("is registered in default MediaScraper registry", () => {
      const scraper = new MediaScraper();
      const found = scraper.getProviderForUrl(
        "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1"
      );
      expect(found).toBeInstanceOf(DramulaProvider);
    });
  });

  describe("parseSeries", () => {
    it("throws NotImplementedError directly", async () => {
      const fetchFn = buildMockFetchFn();
      await expect(
        provider.parseSeries(
          "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1",
          fetchFn
        )
      ).rejects.toThrow(NotImplementedError);
    });
  });

  describe("parseEpisode", () => {
    it("extracts iframe URL, active server label, and sibling episode links from sample-dramula.html fixture", async () => {
      const fetchFn = buildMockFetchFn();
      const episode = await provider.parseEpisode(
        "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1",
        fetchFn
      );

      expect(episode.videoSources).toEqual([
        {
          type: "embed",
          url: "https://videobello.net/embed/ZXBpc29kZToxMDM4Nw.3795c347?source=0",
          label: "BelloCloud",
        },
      ]);

      expect(episode.episodes).toHaveLength(10);
      expect(episode.episodes?.[0]).toEqual({
        title: "1",
        url: "/watch/teach-you-a-lesson-2026/s1e1",
      });
      expect(episode.episodes?.[9]).toEqual({
        title: "10",
        url: "/watch/teach-you-a-lesson-2026/s1e10",
      });

      expect(episode.episodes).toEqual([
        { title: "1", url: "/watch/teach-you-a-lesson-2026/s1e1" },
        { title: "2", url: "/watch/teach-you-a-lesson-2026/s1e2" },
        { title: "3", url: "/watch/teach-you-a-lesson-2026/s1e3" },
        { title: "4", url: "/watch/teach-you-a-lesson-2026/s1e4" },
        { title: "5", url: "/watch/teach-you-a-lesson-2026/s1e5" },
        { title: "6", url: "/watch/teach-you-a-lesson-2026/s1e6" },
        { title: "7", url: "/watch/teach-you-a-lesson-2026/s1e7" },
        { title: "8", url: "/watch/teach-you-a-lesson-2026/s1e8" },
        { title: "9", url: "/watch/teach-you-a-lesson-2026/s1e9" },
        { title: "10", url: "/watch/teach-you-a-lesson-2026/s1e10" },
      ]);
    });
  });

  describe("resolveVideoSources", () => {
    it("returns video sources by wrapping parseEpisode", async () => {
      const fetchFn = buildMockFetchFn();
      const sources = await provider.resolveVideoSources(
        "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1",
        fetchFn
      );

      expect(sources).toEqual([
        {
          type: "embed",
          url: "https://videobello.net/embed/ZXBpc29kZToxMDM4Nw.3795c347?source=0",
          label: "BelloCloud",
        },
      ]);
    });

    it("uses videoSources from context if provided", async () => {
      const fetchFn = buildMockFetchFn();
      const existingSources = [
        {
          type: "embed" as const,
          url: "https://example.com/embed/123",
          label: "CustomServer",
        },
      ];
      const sources = await provider.resolveVideoSources(
        "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1",
        fetchFn,
        { videoSources: existingSources }
      );

      expect(sources).toEqual(existingSources);
    });
  });
});
