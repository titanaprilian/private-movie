import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DramulaProvider,
  MediaScraper,
  EpisodeParseError,
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
    it("fetches HTML and extracts episodes array mirroring episode tiles", async () => {
      const fetchFn = buildMockFetchFn();
      const series = await provider.parseSeries(
        "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1",
        fetchFn
      );

      expect(series.title).toBeTruthy();
      expect(series.episodes).toHaveLength(10);
      expect(series.episodes).toEqual([
        { title: "1", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1" },
        { title: "2", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e2" },
        { title: "3", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e3" },
        { title: "4", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e4" },
        { title: "5", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e5" },
        { title: "6", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e6" },
        { title: "7", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e7" },
        { title: "8", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e8" },
        { title: "9", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e9" },
        { title: "10", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e10" },
      ]);
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
        url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1",
      });
      expect(episode.episodes?.[9]).toEqual({
        title: "10",
        url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e10",
      });

      expect(episode.episodes).toEqual([
        { title: "1", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1" },
        { title: "2", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e2" },
        { title: "3", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e3" },
        { title: "4", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e4" },
        { title: "5", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e5" },
        { title: "6", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e6" },
        { title: "7", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e7" },
        { title: "8", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e8" },
        { title: "9", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e9" },
        { title: "10", url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e10" },
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

  describe("SvelteKit JSON SSR parsing", () => {
    it("extracts episodes from script[data-sveltekit-fetched] when episode-tile DOM nodes are missing", async () => {
      const sveltekitHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Teach You a Lesson - Dramula</title></head>
          <body>
            <h1>Teach You a Lesson</h1>
            <iframe src="https://videobello.net/embed/test"></iframe>
            <script
              type="application/json"
              data-sveltekit-fetched=""
              data-url="https://api.dramula.com/api/titles/teach-you-a-lesson-2026?include=episodes"
            >
              {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "{\\"data\\":{\\"slug\\":\\"teach-you-a-lesson-2026\\",\\"episodes\\":[{\\"episode_number\\":1,\\"name\\":\\"1\\",\\"slug\\":\\"s1e1\\"},{\\"episode_number\\":2,\\"name\\":\\"2\\",\\"slug\\":\\"s1e2\\"}]}}"
              }
            </script>
          </body>
        </html>
      `;

      const episode = await provider.parseEpisodeHtml(sveltekitHtml);

      expect(episode.title).toBe("Teach You a Lesson");
      expect(episode.videoSources).toEqual([
        {
          type: "embed",
          url: "https://videobello.net/embed/test",
          label: "Embed",
        },
      ]);
      expect(episode.episodes).toEqual([
        {
          title: "1",
          url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1",
        },
        {
          title: "2",
          url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e2",
        },
      ]);
    });

    it("ensures relative URLs in script payload or relative paths are formatted as absolute URLs", async () => {
      const sveltekitHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <h1>Some Drama</h1>
            <script
              type="application/json"
              data-sveltekit-fetched=""
            >
              {
                "status": 200,
                "body": {
                  "data": [
                    { "name": "Episode 1", "url": "/watch/some-drama/s1e1" },
                    { "name": "Episode 2", "url": "watch/some-drama/s1e2" }
                  ]
                }
              }
            </script>
          </body>
        </html>
      `;

      const episode = await provider.parseEpisodeHtml(sveltekitHtml);

      expect(episode.episodes).toEqual([
        {
          title: "Episode 1",
          url: "https://dramula.com/watch/some-drama/s1e1",
        },
        {
          title: "Episode 2",
          url: "https://dramula.com/watch/some-drama/s1e2",
        },
      ]);
    });

    it("extracts show slug from /shows/ data-url and injects it into episode URLs when episode slug is relative without show slug", async () => {
      const sveltekitHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <h1>Teach You a Lesson</h1>
            <script
              type="application/json"
              data-sveltekit-fetched=""
              data-url="https://api.dramula.com/api/shows/teach-you-a-lesson-2026/episodes"
            >
              {
                "status": 200,
                "body": {
                  "data": [
                    { "episode_number": 9, "name": "9", "slug": "s1e9" }
                  ]
                }
              }
            </script>
          </body>
        </html>
      `;

      const episode = await provider.parseEpisodeHtml(sveltekitHtml);

      expect(episode.episodes).toEqual([
        {
          title: "9",
          url: "https://dramula.com/watch/teach-you-a-lesson-2026/s1e9",
        },
      ]);
    });

    it("extracts show slug from ep.show?.title_slug or ep.show_slug on episode object", async () => {
      const sveltekitHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <h1>My Drama</h1>
            <script
              type="application/json"
              data-sveltekit-fetched=""
            >
              {
                "status": 200,
                "body": [
                  { "number": 1, "slug": "s1e1", "show": { "title_slug": "my-drama-2026" } },
                  { "number": 2, "slug": "s1e2", "show_slug": "my-drama-2026" }
                ]
              }
            </script>
          </body>
        </html>
      `;

      const episode = await provider.parseEpisodeHtml(sveltekitHtml);

      expect(episode.episodes).toEqual([
        {
          title: "1",
          url: "https://dramula.com/watch/my-drama-2026/s1e1",
        },
        {
          title: "2",
          url: "https://dramula.com/watch/my-drama-2026/s1e2",
        },
      ]);
    });

    it("returns raw .00000000 videoSources from SvelteKit JSON SSR parsing when iframe DOM node is missing without throwing", async () => {
      const sveltekitHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Teach You a Lesson - Dramula</title></head>
          <body>
            <h1>Teach You a Lesson</h1>
            <script src="/_app/immutable/nodes/38.D4Z5fheZ.js"></script>
            <script
              type="application/json"
              data-sveltekit-fetched=""
              data-url="https://api.dramula.com/api/titles/teach-you-a-lesson-2026?include=episodes"
            >
              {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "{\\"data\\":{\\"slug\\":\\"teach-you-a-lesson-2026\\",\\"episodes\\":[{\\"id\\":10387,\\"episode_number\\":10,\\"name\\":\\"10\\",\\"slug\\":\\"s1e10\\"}]}}"
              }
            </script>
          </body>
        </html>
      `;

      const episode = await provider.parseEpisodeHtml(
        sveltekitHtml,
        "https://dramula.com/watch/teach-you-a-lesson-2026/s1e10"
      );

      expect(episode.videoSources).toEqual([
        {
          type: "embed",
          url: "https://videobello.net/embed/ZXBpc29kZToxMDM4Nw.00000000?source=0",
          label: "BelloCloud",
        },
      ]);
    });

    it("resolves 8-character hash in resolveVideoSources when raw .00000000 sources are present", async () => {
      const sveltekitHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Teach You a Lesson - Dramula</title></head>
          <body>
            <h1>Teach You a Lesson</h1>
            <script src="/_app/immutable/nodes/38.D4Z5fheZ.js"></script>
            <script
              type="application/json"
              data-sveltekit-fetched=""
              data-url="https://api.dramula.com/api/titles/teach-you-a-lesson-2026?include=episodes"
            >
              {
                "status": 200,
                "statusText": "OK",
                "headers": {},
                "body": "{\\"data\\":{\\"slug\\":\\"teach-you-a-lesson-2026\\",\\"episodes\\":[{\\"id\\":10387,\\"episode_number\\":10,\\"name\\":\\"10\\",\\"slug\\":\\"s1e10\\"}]}}"
              }
            </script>
          </body>
        </html>
      `;

      const mockFetchFn: FetchFn = {
        async get(url: string) {
          if (url === "https://dramula.com/watch/teach-you-a-lesson-2026/s1e10") {
            return sveltekitHtml;
          }
          if (url === "https://dramula.com/_app/immutable/nodes/38.D4Z5fheZ.js") {
            return `
              const domain = "https://videobello.net/embed/";
              const suffix = ".3795c347?source=0";
            `;
          }
          throw new Error(`Unexpected fetch URL: ${url}`);
        },
        async post() {
          throw new Error("Not implemented");
        },
      };

      const sources = await provider.resolveVideoSources(
        "https://dramula.com/watch/teach-you-a-lesson-2026/s1e10",
        mockFetchFn
      );

      expect(sources).toEqual([
        {
          type: "embed",
          url: "https://videobello.net/embed/ZXBpc29kZToxMDM4Nw.3795c347?source=0",
          label: "BelloCloud",
        },
      ]);
    });

    it("upgrades raw .00000000 sources in resolveVideoSources using browserFn when provided", async () => {
      const rawSources = [
        {
          type: "embed" as const,
          url: "https://videobello.net/embed/ZXBpc29kZToxMDM4Nw.00000000?source=0",
          label: "BelloCloud",
        },
      ];

      const mockBrowserFn = async () => `
        <html>
          <body>
            <iframe src="https://videobello.net/embed/ZXBpc29kZToxMDM4Nw.99999999?source=0"></iframe>
          </body>
        </html>
      `;

      const mockFetchFn: FetchFn = {
        async get() {
          return "";
        },
        async post() {
          return "";
        },
      };

      const sources = await provider.resolveVideoSources(
        "https://dramula.com/watch/teach-you-a-lesson-2026/s1e10",
        mockFetchFn,
        { videoSources: rawSources },
        mockBrowserFn
      );

      expect(sources).toEqual([
        {
          type: "embed",
          url: "https://videobello.net/embed/ZXBpc29kZToxMDM4Nw.99999999?source=0",
          label: "BelloCloud",
        },
      ]);
    });

    it("throws explicit error in resolveVideoSources when Svelte JS bundle fails to fetch or hash cannot be extracted", async () => {
      const sveltekitHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Teach You a Lesson - Dramula</title>
            <link rel="canonical" href="https://dramula.com/watch/teach-you-a-lesson-2026/s1e10" />
          </head>
          <body>
            <h1>Teach You a Lesson</h1>
            <script src="/_app/immutable/nodes/38.js"></script>
            <script
              type="application/json"
              data-sveltekit-fetched=""
            >
              {
                "status": 200,
                "body": {
                  "data": {
                    "episodes": [
                      { "id": 10387, "slug": "s1e10" }
                    ]
                  }
                }
              }
            </script>
          </body>
        </html>
      `;

      const failingFetchFn: FetchFn = {
        async get(url: string) {
          if (url === "https://dramula.com/watch/teach-you-a-lesson-2026/s1e10") {
            return sveltekitHtml;
          }
          return "console.log('no hash here');";
        },
        async post() {
          throw new Error("Not implemented");
        },
      };

      await expect(
        provider.resolveVideoSources(
          "https://dramula.com/watch/teach-you-a-lesson-2026/s1e10",
          failingFetchFn
        )
      ).rejects.toThrow(EpisodeParseError);
    });
  });
});
