import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EpisodeParseError,
  extractRawStreamUrl,
  parseEpisodeOrder,
  parseEpisodePage,
} from "@/modules/media/internal/episodes/parse";

type ParsedEpisode = { label: string; url: string };
type ParsedHost = { host: string; url: string };
type ParsedDownloadLink = {
  quality: string;
  size: string | null;
  hosts: ParsedHost[];
};

const fixtures = {
  minimal: resolve(
    import.meta.dirname,
    "../../fixtures/episodes/sample-a.html"
  ),
  full: resolve(import.meta.dirname, "../../fixtures/episodes/sample-b.html"),
};

const readFixture = (path: string): string => readFileSync(path, "utf8");

describe("parseEpisodeOrder", () => {
  it("extracts integer from various title formats", () => {
    expect(parseEpisodeOrder("Episode 12")).toBe(12);
    expect(parseEpisodeOrder("One Piece Episode 1080 Subtitle Indonesia")).toBe(1080);
    expect(parseEpisodeOrder("Eps 5 Sub Indo")).toBe(5);
    expect(parseEpisodeOrder("Ep. 03")).toBe(3);
    expect(parseEpisodeOrder("Ep 004")).toBe(4);
    expect(parseEpisodeOrder("#15")).toBe(15);
    expect(parseEpisodeOrder("Bleach 366 Sub Indo")).toBe(366);
  });

  it("returns null for titles without clear episode numbers", () => {
    expect(parseEpisodeOrder("Movie Special")).toBeNull();
    expect(parseEpisodeOrder("Special OVA 2024")).toBeNull();
  });
});

describe("parseEpisodePage", () => {
  describe("minimal variant (sample-a, odvidhide embed)", () => {
    const result = parseEpisodePage(readFixture(fixtures.minimal));

    it("extracts the title from the page heading", () => {
      expect(result.title).toBe(
        "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru Episode 7 Subtitle Indonesia"
      );
    });

    it("extracts the iframe src as embedUrl and extracts raw mp4 if present", () => {
      expect(result.embedUrl).toBe("https://odvidhide.com/embed/sylmpeaf3wzs");
      expect(result.videoUrl).toBeNull();
    });

    it("leaves videoType null when there is no info block", () => {
      expect(result.videoType).toBeNull();
    });

    it("parses the episode list excluding the placeholder option", () => {
      const episodes = result.metadata.episodes;
      expect(episodes).toHaveLength(7);
      expect(
        episodes?.some((episode: ParsedEpisode) => episode.url === "0")
      ).toBe(false);
      expect(
        episodes?.some(
          (episode: ParsedEpisode) => episode.label === "Pilih Episode Lainnya"
        )
      ).toBe(false);
      expect(episodes?.[0]).toEqual({
        label: "Episode 7",
        url: "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
      });
    });

    it("omits download links and other absent metadata keys", () => {
      expect(result.metadata.downloadLinks).toBeUndefined();
      expect(result.metadata.genres).toBeUndefined();
      expect(result.metadata.duration).toBeUndefined();
      expect(result.metadata.posterUrl).toBeUndefined();
    });

    it("keeps the anime page URL in metadata", () => {
      expect(result.metadata.animePageUrl).toBe(
        "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/"
      );
    });
  });

  describe("full variant (sample-b, desustream embed + info block)", () => {
    const result = parseEpisodePage(readFixture(fixtures.full));

    it("extracts the title and the desustream embed embedUrl and decodes videoUrl", () => {
      expect(result.title).toBe(
        "Katainaka no Ossan, Kensei ni Naru Season 2 Episode 6 Subtitle Indonesia"
      );
      expect(result.embedUrl).toBe(
        "https://desustream.net/dstream/arcg/?id=aHR0cHM6Ly9kZXN1c3RyZWFtLm5ldC9zdHJlYW0vc2FtcGxlLTYubXA0"
      );
      expect(result.videoUrl).toBe(
        "https://desustream.net/stream/sample-6.mp4"
      );
    });

    it("reads videoType from the info block", () => {
      expect(result.videoType).toBe("TV");
    });

    it("extracts genres from the info block", () => {
      expect(result.metadata.genres).toEqual(["Action", "Fantasy"]);
    });

    it("extracts the duration string from the info block", () => {
      expect(result.metadata.duration).toBe("23 min. per ep.");
    });

    it("extracts the poster image URL from .cukder", () => {
      expect(result.metadata.posterUrl).toBe(
        "https://otakudesu.blog/wp-content/uploads/2026/07/157173.jpg"
      );
    });

    it("parses download links with quality, size, and host lists", () => {
      const downloadLinks = result.metadata.downloadLinks;
      expect(downloadLinks).toHaveLength(6);

      const qualities = downloadLinks?.map(
        (entry: ParsedDownloadLink) => entry.quality
      );
      expect(qualities).toEqual([
        "Mp4 360p",
        "Mp4 480p",
        "Mp4 720p",
        "MKV 480p",
        "MKV 720p",
        "MKV 1080p",
      ]);

      expect(downloadLinks?.[0]).toEqual({
        quality: "Mp4 360p",
        size: "40.7 MB",
        hosts: [
          {
            host: "Filedon",
            url: "https://link.desustream.com/?id=Uk83OUt2T214S3VpS0ZVRndDV3NlYWNtWm9RbTYzZ2ljbUxvNG4ydUMrdXo0dz09",
          },
          {
            host: "Pdrain",
            url: "https://link.desustream.com/?id=Uk83OUt2T214S3UwS0VFRnlDNndOcTBuWjVFZzR5QjRNMVcrdFc2RkM3dUE=",
          },
          {
            host: "Acefile",
            url: "https://link.desustream.com/?id=Uk83OUt2T214S3VsSWx3R3pTYW5lYWNtWnBSZ3Z6NC9MQWpwdWh2d1ZPYU03NUZrL2FKUUducjRGUUI5enVaSU1GaU0vQldNaHFKZjBIQk05QXdT",
          },
          { host: "GoFile", url: "https://link.desustream.com/?id=Uk83OUt2T214S3VqTGw4SnlDL3NQcXRtTGQwSisyZExaV21KN0E9PQ==" },
          {
            host: "Mega",
            url: "https://link.desustream.com/?id=Uk83OUt2T214S3VwSkY0QmlpUzRlS0lnSlpkZ3pHVkRjVWlHNUh2Z0grREwyOGg5eWFKZ1hpZjZTV2RTMU9aalJVRDluV25Ec1BjRmlFazd6QWtTL1BlM3F3YXJhamxCRHc9PQ==",
          },
          {
            host: "VikingFile",
            url: "https://link.desustream.com/?id=Uk83OUt2T214S3V5S0ZJSnlpMmtQcWdzWjVFZzR5QnJNM0crNEZ6Mkg3elArYjA9",
          },
        ],
      });
    });

    it("extracts nothing from the mirror switcher section", () => {
      const urls = result.metadata.downloadLinks?.flatMap(
        (entry: ParsedDownloadLink) => entry.hosts.map((host) => host.url)
      );
      expect(urls?.every((url: string) => url.startsWith("http"))).toBe(true);
      expect(urls?.some((url: string) => url === "#")).toBe(false);
    });

    it("parses the episode list excluding the placeholder option", () => {
      const episodes = result.metadata.episodes;
      expect(episodes).toHaveLength(6);
      expect(episodes?.[0]).toEqual({
        label: "Episode 6",
        url: "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
      });
    });
  });

  describe("extractRawStreamUrl", () => {
    it("extracts direct .mp4 URL from obfuscated base64 id param in embedUrl", () => {
      // Base64 encoded "https://cdn.example.com/video/ep1.mp4"
      const encoded = btoa("https://cdn.example.com/video/ep1.mp4");
      const url = `https://desustream.net/dstream/arcg/?id=${encoded}`;
      expect(extractRawStreamUrl(url)).toBe("https://cdn.example.com/video/ep1.mp4");
    });

    it("handles double-encoded base64 id param containing .mp4 URL", () => {
      const first = btoa("https://cdn.example.com/video/ep2.mp4");
      const second = btoa(first);
      const url = `https://desustream.net/dstream/arcg/?id=${second}`;
      expect(extractRawStreamUrl(url)).toBe("https://cdn.example.com/video/ep2.mp4");
    });

    it("returns null when id param is missing or cannot be decoded into .mp4 URL", () => {
      expect(extractRawStreamUrl("https://odvidhide.com/embed/sylmpeaf3wzs")).toBeNull();
      expect(extractRawStreamUrl("https://desustream.net/dstream/arcg/?id=invalidBase64!")).toBeNull();
    });
  });

  describe("validation errors", () => {
    it("throws when the #venkonten container is missing", () => {
      expect(() => parseEpisodePage("<div><p>no container</p></div>")).toThrow(
        EpisodeParseError
      );
    });

    it("throws when the title is missing", () => {
      const html =
        '<div id="venkonten"><div class="responsive-embed-stream"><iframe src="https://example.com/embed/abc"></iframe></div></div>';
      expect(() => parseEpisodePage(html)).toThrow(EpisodeParseError);
    });

    it("throws when the iframe or its src is missing", () => {
      const html =
        '<div id="venkonten"><h1 class="posttl">Some Episode</h1><div class="responsive-embed-stream"></div></div>';
      expect(() => parseEpisodePage(html)).toThrow(EpisodeParseError);
    });
  });
});