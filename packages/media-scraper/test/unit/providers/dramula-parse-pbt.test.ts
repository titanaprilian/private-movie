import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  extractEpisodesFromPayload,
  formatDramulaUrl,
  parseDramulaEpisodeHtml,
} from "../../../src";

describe("Dramula property-based tests", () => {
  describe("formatDramulaUrl PBT", () => {
    it("never throws for arbitrary strings or slugs", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.option(fc.string(), { nil: undefined }),
          (raw, slug) => {
            const formatted = formatDramulaUrl(raw, slug);
            return typeof formatted === "string";
          },
        ),
        { numRuns: 150 },
      );
    });

    it("converges to canonical URL and is idempotent once canonical", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.option(fc.string(), { nil: undefined }),
          (raw, slug) => {
            const canonical = formatDramulaUrl(
              formatDramulaUrl(raw, slug),
              slug,
            );
            const next = formatDramulaUrl(canonical, slug);
            return next === canonical;
          },
        ),
        { numRuns: 150 },
      );
    });

    it("is strictly idempotent on standard web path segments", () => {
      const pathArb = fc.stringMatching(/^[a-zA-Z0-9_\-\/]{1,40}$/);
      const slugArb = fc.stringMatching(/^[a-zA-Z0-9_\-]{1,20}$/);

      fc.assert(
        fc.property(
          pathArb,
          fc.option(slugArb, { nil: undefined }),
          (path, slug) => {
            const pass1 = formatDramulaUrl(path, slug);
            const pass2 = formatDramulaUrl(pass1, slug);
            return pass1 === pass2;
          },
        ),
        { numRuns: 150 },
      );
    });

    it("preserves standard relative /watch paths under https://dramula.com", () => {
      const slugSegmentArb = fc
        .stringMatching(/^[a-zA-Z0-9_-]{1,20}$/)
        .filter((s) => Boolean(s));

      fc.assert(
        fc.property(slugSegmentArb, slugSegmentArb, (slug1, slug2) => {
          const path = `/watch/${slug1}/${slug2}`;
          const formatted = formatDramulaUrl(path);
          return formatted === `https://dramula.com${path}`;
        }),
        { numRuns: 100 },
      );
    });

    it("leaves external non-dramula URLs unchanged", () => {
      const hostArb = fc
        .stringMatching(/^[a-z]{3,10}\.(org|net|io)$/)
        .filter((h) => !h.includes("dramula"));

      fc.assert(
        fc.property(hostArb, (host) => {
          const raw = `https://${host}/video/play?id=123`;
          const formatted = formatDramulaUrl(raw);
          return formatted === raw;
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("extractEpisodesFromPayload PBT", () => {
    it("never crashes for arbitrary or adversarial payloads", () => {
      fc.assert(
        fc.property(
          fc.jsonValue(),
          fc.option(fc.string(), { nil: undefined }),
          (payload, slug) => {
            const result = extractEpisodesFromPayload(payload, slug);
            return Array.isArray(result);
          },
        ),
        { numRuns: 150 },
      );
    });

    it("always produces valid ScrapedEpisodeRef objects with non-empty string fields", () => {
      fc.assert(
        fc.property(
          fc.jsonValue(),
          fc.option(fc.string(), { nil: undefined }),
          (payload, slug) => {
            const result = extractEpisodesFromPayload(payload, slug);
            return result.every(
              (item) =>
                typeof item.title === "string" &&
                item.title.length > 0 &&
                typeof item.url === "string" &&
                item.url.length > 0,
            );
          },
        ),
        { numRuns: 150 },
      );
    });

    it("guarantees unique URLs in the returned episode list", () => {
      fc.assert(
        fc.property(
          fc.jsonValue(),
          fc.option(fc.string(), { nil: undefined }),
          (payload, slug) => {
            const result = extractEpisodesFromPayload(payload, slug);
            const urls = result.map((r) => r.url);
            const uniqueUrls = new Set(urls);
            return urls.length === uniqueUrls.size;
          },
        ),
        { numRuns: 150 },
      );
    });

    it("correctly extracts valid episodes from synthetic API payload shapes", () => {
      const titleArb = fc
        .stringMatching(/^[a-zA-Z0-9\s]{1,30}$/)
        .map((s) => s.trim() || "Episode");
      const pathArb = fc
        .stringMatching(/^[a-zA-Z0-9_-]{1,20}$/)
        .map((s) => `/watch/drama/${s}`);

      const episodeItemArb = fc.record({
        title: titleArb,
        url: pathArb,
      });

      fc.assert(
        fc.property(fc.array(episodeItemArb, { maxLength: 10 }), (episodes) => {
          const payload = { data: episodes };
          const result = extractEpisodesFromPayload(payload);
          return (
            result.length <= episodes.length &&
            result.every((ep) =>
              ep.url.startsWith("https://dramula.com/watch/drama/"),
            )
          );
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("parseDramulaEpisodeHtml PBT", () => {
    it("never crashes and always returns valid ScrapedEpisode for arbitrary HTML", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (html) => {
          const result = await parseDramulaEpisodeHtml(html);
          const urls = result.episodes?.map((e) => e.url) ?? [];
          const uniqueUrls = new Set(urls);

          return (
            typeof result.title === "string" &&
            result.title.length > 0 &&
            Array.isArray(result.videoSources) &&
            Array.isArray(result.episodes) &&
            urls.length === uniqueUrls.size
          );
        }),
        { numRuns: 100 },
      );
    });

    it("extracts title, embed video source, and episode tiles from synthetic HTML", async () => {
      const titleArb = fc
        .stringMatching(/^[a-zA-Z0-9 ]{1,30}$/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const embedUrlArb = fc
        .stringMatching(/^[a-z0-9_-]{3,15}$/)
        .map((s) => `https://embed.example.com/${s}`);
      const slugArb = fc
        .stringMatching(/^[a-z0-9_-]{3,15}$/)
        .filter((s) => s.length > 0);

      await fc.assert(
        fc.asyncProperty(
          titleArb,
          embedUrlArb,
          fc.array(slugArb, { minLength: 1, maxLength: 5 }),
          async (title, embedUrl, slugs) => {
            const tiles = slugs
              .map(
                (slug, i) =>
                  `<a class="episode-tile" href="/watch/drama/${slug}">Episode ${i + 1}</a>`,
              )
              .join("\n");

            const html = `
              <ol><span aria-current="page">${title}</span></ol>
              <iframe src="${embedUrl}"></iframe>
              <div class="episodes">${tiles}</div>
            `;

            const result = await parseDramulaEpisodeHtml(html);
            const expectedCount = new Set(
              slugs.map((s) => `https://dramula.com/watch/drama/${s}`),
            ).size;

            return (
              result.title === title &&
              result.videoSources.length === 1 &&
              result.videoSources[0]?.url === embedUrl &&
              result.episodes?.length === expectedCount
            );
          },
        ),
        { numRuns: 80 },
      );
    });

    it("parses embedded SvelteKit fetched JSON data without throwing", async () => {
      const showSlugArb = fc
        .stringMatching(/^[a-z0-9_-]{3,15}$/)
        .filter((s) => s.length > 0);
      const epSlugArb = fc
        .stringMatching(/^[a-z0-9_-]{3,15}$/)
        .filter((s) => s.length > 0);

      await fc.assert(
        fc.asyncProperty(
          showSlugArb,
          fc.array(epSlugArb, { minLength: 1, maxLength: 5 }),
          async (showSlug, epSlugs) => {
            const episodesData = epSlugs.map((s, idx) => ({
              title: `Ep ${idx + 1}`,
              slug: s,
              url: `/watch/${showSlug}/${s}`,
            }));

            const scriptPayload = {
              body: JSON.stringify({
                data: {
                  slug: showSlug,
                  episodes: episodesData,
                },
              }),
            };

            const html = `
              <h1>Sample Show</h1>
              <script data-sveltekit-fetched data-url="/api/shows/${showSlug}">
                ${JSON.stringify(scriptPayload)}
              </script>
            `;

            const result = await parseDramulaEpisodeHtml(html);
            const uniqueExpected = new Set(
              epSlugs.map((s) => `https://dramula.com/watch/${showSlug}/${s}`),
            ).size;

            return (
              result.title === "Sample Show" &&
              result.episodes?.length === uniqueExpected &&
              result.episodes.every((ep) =>
                ep.url.startsWith(`https://dramula.com/watch/${showSlug}/`),
              )
            );
          },
        ),
        { numRuns: 80 },
      );
    });
  });
});
