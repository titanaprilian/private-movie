import { describe, expect, it } from "vitest";
import {
  normalizePlaybackUrl,
  normalizeVideoSource,
  normalizeVideoSources,
} from "../../../src/internal/playback/normalization";

describe("playback target normalization", () => {
  describe("normalizePlaybackUrl", () => {
    it("normalizes videobello.net embed URLs to local /embed/{hash} paths", () => {
      const url = "https://videobello.net/embed/ZXBpc29kZToxMDM4Nw.00000000?source=0";
      expect(normalizePlaybackUrl(url)).toBe("/embed/ZXBpc29kZToxMDM4Nw.00000000?source=0");
    });

    it("normalizes videobello.net URLs without protocol", () => {
      const url = "videobello.net/embed/abc123hash?query=val";
      expect(normalizePlaybackUrl(url)).toBe("/embed/abc123hash?query=val");
    });

    it("preserves already normalized /embed/{hash} paths", () => {
      const url = "/embed/ZXBpc29kZToxMDM4Nw.00000000?source=0";
      expect(normalizePlaybackUrl(url)).toBe("/embed/ZXBpc29kZToxMDM4Nw.00000000?source=0");
    });

    it("preserves direct media target URLs", () => {
      const url = "https://cdn.example.com/videos/episode1.mp4";
      expect(normalizePlaybackUrl(url)).toBe("https://cdn.example.com/videos/episode1.mp4");
    });

    it("preserves non-videobello embed target URLs", () => {
      const url = "https://otherprovider.com/embed/98765";
      expect(normalizePlaybackUrl(url)).toBe("https://otherprovider.com/embed/98765");
    });

    it("falls back to proxy-embed for videobello URLs where hash extraction fails", () => {
      const url = "https://videobello.net/v/non-standard-path";
      expect(normalizePlaybackUrl(url)).toBe(
        `/api/media/proxy-embed?url=${encodeURIComponent(url)}`
      );
    });
  });

  describe("normalizeVideoSource", () => {
    it("normalizes the url property while keeping other fields intact", () => {
      const source = {
        id: "src-1",
        episodeId: "ep-1",
        type: "embed",
        url: "https://videobello.net/embed/hash123",
        label: "BelloCloud",
        quality: "1080p",
      };

      const result = normalizeVideoSource(source);

      expect(result).toEqual({
        id: "src-1",
        episodeId: "ep-1",
        type: "embed",
        url: "/embed/hash123",
        label: "BelloCloud",
        quality: "1080p",
      });
    });
  });

  describe("normalizeVideoSources", () => {
    it("normalizes an array of video sources including direct and embed targets", () => {
      const sources = [
        {
          id: "src-1",
          type: "embed",
          url: "https://videobello.net/embed/hash1",
        },
        {
          id: "src-2",
          type: "direct",
          url: "https://stream.example.com/video.m3u8",
        },
      ];

      const result = normalizeVideoSources(sources);

      expect(result).toEqual([
        {
          id: "src-1",
          type: "embed",
          url: "/embed/hash1",
        },
        {
          id: "src-2",
          type: "direct",
          url: "https://stream.example.com/video.m3u8",
        },
      ]);
    });
  });
});
