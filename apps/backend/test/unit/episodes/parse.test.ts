import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EpisodeParseError,
  extractAjaxActions,
  extractDirectVideoSources,
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

    it("extracts the iframe src as an embed video source", () => {
      expect(result.videoSources).toEqual([
        {
          type: "embed",
          url: "https://odvidhide.com/embed/sylmpeaf3wzs",
          label: "Server Embed",
        },
      ]);
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

    it("falls back to an empty mirror payload list when the m720p section is missing", () => {
      expect(result.mirrorPayloads).toEqual([]);
    });

    it("leaves ajax actions null when no action script is present", () => {
      expect(result.ajaxActions).toBeNull();
    });
  });

  describe("full variant (sample-b, desustream embed + info block)", () => {
    const result = parseEpisodePage(readFixture(fixtures.full));

    it("extracts title and video sources containing only embed sources", () => {
      expect(result.title).toBe(
        "Katainaka no Ossan, Kensei ni Naru Season 2 Episode 6 Subtitle Indonesia"
      );

      expect(result.videoSources).toEqual([
        {
          type: "embed",
          url: "https://desustream.net/dstream/arcg/?id=aHR0cHM6Ly9kZXN1c3RyZWFtLm5ldC9zdHJlYW0vc2FtcGxlLTYubXA0",
          label: "Server Embed",
        },
      ]);
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

    it("extracts mirror payloads with decoded data-content from the m720p section", () => {
      expect(result.mirrorPayloads).toEqual([
        { id: 201406, i: 0, q: "720p", label: "ondesu2hd" },
        { id: 201406, i: 1, q: "720p", label: "odstream" },
        { id: 201406, i: 2, q: "720p", label: "filedon" },
        { id: 201406, i: 3, q: "720p", label: "vidhide" },
        { id: 201406, i: 4, q: "720p", label: "mega" },
      ]);
    });

    it("extracts the AJAX action names from the inline script", () => {
      expect(result.ajaxActions).toEqual({
        nonceAction: "aa1208d27f29ca340c92c66d1926f13f",
        mirrorAction: "2a3505c93b0035d3f455df82bf976b84",
      });
    });
  });

  describe("extractAjaxActions", () => {
    it("returns null when no script tags exist", () => {
      expect(extractAjaxActions("<html><body><p>plain</p></body></html>")).toBeNull();
    });

    it("returns null when the script lacks the expected action patterns", () => {
      const html =
        '<script>$(document).ready(function(){console.log("hi");});</script>';
      expect(extractAjaxActions(html)).toBeNull();
    });

    it("extracts both action names from a minified mirrorstream script", () => {
      const html =
        '<script>window.__x__nonce=null,$(\'.mirrorstream a[href^="#"]\').on("click",function(a){a.preventDefault();const n=a.currentTarget,e=JSON.parse(atob(n.dataset.content));$.ajax("https://otakudesu.blog/wp-admin/admin-ajax.php",{method:"POST",processData:!0,cache:!0,data:{...e,nonce:window.__x__nonce,action:"2a3505c93b0035d3f455df82bf976b84"}}).done(({data:a})=>{document.getElementById("pembed").innerHTML=atob(a)}).fail(function(){}):$.ajax("https://otakudesu.blog/wp-admin/admin-ajax.php",{method:"POST",processData:!0,cache:!0,data:{action:"aa1208d27f29ca340c92c66d1926f13f"}}).done(({data:a})=>{window.__x__nonce=a;}).fail(function(){})});</script>';
      expect(extractAjaxActions(html)).toEqual({
        nonceAction: "aa1208d27f29ca340c92c66d1926f13f",
        mirrorAction: "2a3505c93b0035d3f455df82bf976b84",
      });
    });

    it("handles single-quoted action strings and whitespace", () => {
      const html =
        '<script>data:{ action : \'aa1208d27f29ca340c92c66d1926f13f\' },data:{ ...e, nonce: n, action : \'2a3505c93b0035d3f455df82bf976b84\' }</script>';
      expect(extractAjaxActions(html)).toEqual({
        nonceAction: "aa1208d27f29ca340c92c66d1926f13f",
        mirrorAction: "2a3505c93b0035d3f455df82bf976b84",
      });
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

describe("extractDirectVideoSources", () => {
  const mp4FixturePath = resolve(
    import.meta.dirname,
    "../../fixtures/episodes/sample-mp4-video.html"
  );
  const readFixture = (path: string): string => readFileSync(path, "utf8");

  it("extracts video sources from the MP4 fixture HTML", () => {
    const html = readFixture(mp4FixturePath);
    const result = extractDirectVideoSources(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "direct" as const,
      url: "https://archive.org/download/diri-dari-skenario-yang-telah-ia-program-sendiri.dwa/Otakudesu.io_TSTJ--01_720p.mp4",
      label: "Otakudesu.io_TSTJ--01_720p",
      quality: "720p",
    });
  });

  it("returns an empty array when no <video> tags exist", () => {
    const html = "<html><body><p>no videos here</p></body></html>";
    expect(extractDirectVideoSources(html)).toEqual([]);
  });

  it("returns an empty array for HTML without any video elements with .mp4 src", () => {
    const html = `
      <div>
        <video><source src="https://example.com/stream.m3u8"></video>
        <video><source src="https://example.com/video.webm"></video>
      </div>
    `;
    expect(extractDirectVideoSources(html)).toEqual([]);
  });

  it("returns an empty array for a plain string with no video tags", () => {
    expect(extractDirectVideoSources("just some text")).toEqual([]);
    expect(extractDirectVideoSources("")).toEqual([]);
  });

  it("extracts multiple direct MP4 sources when multiple video tags exist", () => {
    const html = `
      <div>
        <video src="https://example.com/video_480p.mp4"></video>
        <video src="https://example.com/movie_1080p.mp4"></video>
      </div>
    `;
    const result = extractDirectVideoSources(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: "direct",
      url: "https://example.com/video_480p.mp4",
      label: "video_480p",
      quality: "480p",
    });
    expect(result[1]).toEqual({
      type: "direct",
      url: "https://example.com/movie_1080p.mp4",
      label: "movie_1080p",
      quality: "1080p",
    });
  });

  it("extracts quality from filename matching patterns like 720p, 1080p, 480p case-insensitively", () => {
    const html = `
      <div>
        <video src="https://example.com/file_480P.mp4"></video>
        <video src="https://example.com/file_XS.mp4"></video>
      </div>
    `;
    const result = extractDirectVideoSources(html);
    expect(result).toHaveLength(2);
    expect(result[0].quality).toBe("480p");
    expect(result[1].quality).toBeNull();
  });

  it("sets quality to null when no quality pattern is found in the filename", () => {
    const html = `<video src="https://example.com/myvideo.mp4"></video>`;
    const result = extractDirectVideoSources(html);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("myvideo");
    expect(result[0].quality).toBeNull();
  });

  it("derives label from basename between last / and .mp4", () => {
    const html = `<video src="https://example.com/path/to/filename.mkv.mp4"></video>`;
    const result = extractDirectVideoSources(html);
    expect(result[0].url).toBe("https://example.com/path/to/filename.mkv.mp4");
    expect(result[0].label).toBe("filename.mkv");
  });

  it("handles video tags where src is on the video element itself (not a child source tag)", () => {
    const html = `<video preload="none" src="https://archive.org/video/test_720p.mp4" style="width:100%"></video>`;
    const result = extractDirectVideoSources(html);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://archive.org/video/test_720p.mp4");
    expect(result[0].label).toBe("test_720p");
    expect(result[0].quality).toBe("720p");
  });
});
