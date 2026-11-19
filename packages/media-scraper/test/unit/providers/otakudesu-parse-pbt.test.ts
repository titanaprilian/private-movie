import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  EpisodeMissingFieldsError,
  EpisodeParseError,
  extractAjaxActions,
  extractDirectVideoSources,
  extractQualityFromLabel,
  OtakudesuProvider,
  parseEpisodeOrder,
  parseEpisodePage,
  parseFullListHtml,
  QUALITY_PATTERN,
  SeriesParseError,
} from "../../../src";

describe("Otakudesu property-based tests", () => {
  const otakudesuProvider = new OtakudesuProvider();
  describe("parseEpisodeOrder PBT", () => {
    it("never crashes and returns finite number or null for arbitrary strings", () => {
      fc.assert(
        fc.property(fc.string(), (raw) => {
          const result = parseEpisodeOrder(raw);
          return (
            result === null ||
            (typeof result === "number" &&
              !Number.isNaN(result) &&
              Number.isFinite(result))
          );
        }),
        { numRuns: 150 },
      );
    });

    it("reliably extracts episode number from standard marker formats", () => {
      const markerArb = fc.constantFrom(
        "Episode",
        "episode",
        "Eps",
        "eps",
        "Ep",
        "ep",
        "Ep.",
        "ep.",
        "#",
      );
      const epNumArb = fc.integer({ min: 1, max: 9999 });
      // Sanitize prefix/suffix to avoid introducing other digits/markers
      const wordArb = fc
        .stringMatching(/^[a-zA-Z\s]{0,25}$/)
        .map((s) => s.trim());

      fc.assert(
        fc.property(
          wordArb,
          markerArb,
          epNumArb,
          wordArb,
          (prefix, marker, epNum, suffix) => {
            const title = `${prefix} ${marker} ${epNum} ${suffix}`.trim();
            const result = parseEpisodeOrder(title);
            return result === epNum;
          },
        ),
        { numRuns: 150 },
      );
    });

    it("extracts bare numbers outside year range [1900, 2100]", () => {
      const nonYearEpArb = fc.oneof(
        fc.integer({ min: 1, max: 1899 }),
        fc.integer({ min: 2101, max: 9999 }),
      );
      const titleArb = fc
        .stringMatching(/^[a-zA-Z\s]{1,20}$/)
        .map((s) => s.trim() || "Anime")
        .filter((s) => !/(?:episode|eps|ep|#)/i.test(s));

      fc.assert(
        fc.property(titleArb, nonYearEpArb, (title, epNum) => {
          const formatted = `${title} ${epNum} Sub Indo`;
          const result = parseEpisodeOrder(formatted);
          return result === epNum;
        }),
        { numRuns: 100 },
      );
    });

    it("ignores standalone release years between 1900 and 2100", () => {
      const yearArb = fc.integer({ min: 1900, max: 2100 });
      const titleArb = fc
        .stringMatching(/^[a-zA-Z\s]{1,20}$/)
        .map((s) => s.trim() || "Anime Movie")
        .filter((s) => !/(?:episode|eps|ep|#)/i.test(s));

      fc.assert(
        fc.property(titleArb, yearArb, (title, year) => {
          const formatted = `${title} ${year} Movie`;
          const result = parseEpisodeOrder(formatted);
          return result === null;
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("extractQualityFromLabel & QUALITY_PATTERN PBT", () => {
    it("never throws for arbitrary strings and returns null or lowercased resolution", () => {
      fc.assert(
        fc.property(fc.string(), (label) => {
          const quality = extractQualityFromLabel(label);
          if (quality === null) return true;
          return (
            /^\d{3,4}p$/.test(quality) && quality === quality.toLowerCase()
          );
        }),
        { numRuns: 150 },
      );
    });

    it("correctly identifies resolution tag from arbitrary surroundings", () => {
      const resolutionArb = fc.constantFrom(
        "360",
        "480",
        "720",
        "1080",
        "2160",
      );
      const casingArb = fc.constantFrom("p", "P");
      const padArb = fc
        .stringMatching(/^[a-zA-Z0-9\s_-]{0,20}$/)
        .map((s) => s.replace(/[a-zA-Z]$/, " "));

      fc.assert(
        fc.property(
          padArb,
          resolutionArb,
          casingArb,
          padArb,
          (prefix, res, suffixCase, suffix) => {
            const label = `${prefix} ${res}${suffixCase} ${suffix}`;
            const extracted = extractQualityFromLabel(label);
            return extracted === `${res}p`;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("parseEpisodePage PBT", () => {
    it("never crashes with undeclared exceptions for arbitrary HTML", () => {
      fc.assert(
        fc.property(fc.string(), (html) => {
          try {
            const result = parseEpisodePage(html);
            return (
              typeof result.title === "string" &&
              result.title.length > 0 &&
              Array.isArray(result.videoSources) &&
              result.videoSources.length > 0
            );
          } catch (err) {
            return (
              err instanceof EpisodeParseError ||
              err instanceof EpisodeMissingFieldsError
            );
          }
        }),
        { numRuns: 150 },
      );
    });

    it("always throws EpisodeParseError when #venkonten is absent", () => {
      // Generate HTML without the venkonten id
      const tagArb = fc
        .stringMatching(/^[a-z]{1,6}$/)
        .filter((t) => t.length > 0);
      const textArb = fc.stringMatching(/^[a-zA-Z0-9\s]{0,30}$/);

      fc.assert(
        fc.property(tagArb, textArb, (tag, text) => {
          const html = `<${tag} class="content">${text}</${tag}>`;
          try {
            parseEpisodePage(html);
            return false;
          } catch (err) {
            return err instanceof EpisodeParseError;
          }
        }),
        { numRuns: 100 },
      );
    });

    it("throws EpisodeMissingFieldsError when #venkonten exists but lacks title or embedUrl", () => {
      const textArb = fc.stringMatching(/^[a-zA-Z0-9\s]{0,30}$/);

      fc.assert(
        fc.property(textArb, (text) => {
          const html = `<div id="venkonten"><p>${text}</p></div>`;
          try {
            parseEpisodePage(html);
            return false;
          } catch (err) {
            return (
              err instanceof EpisodeMissingFieldsError &&
              err.missingFields.length > 0
            );
          }
        }),
        { numRuns: 100 },
      );
    });

    it("successfully parses well-formed synthetic episode HTML", () => {
      const titleArb = fc
        .stringMatching(/^[a-zA-Z0-9 ]{1,30}$/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const embedUrlArb = fc
        .stringMatching(/^[a-z0-9_-]{3,15}$/)
        .map((s) => `https://embed.example.com/${s}`);

      fc.assert(
        fc.property(titleArb, embedUrlArb, (title, embedUrl) => {
          const html = `
            <div id="venkonten">
              <h1 class="posttl">${title}</h1>
              <div class="responsive-embed-stream">
                <iframe src="${embedUrl}"></iframe>
              </div>
            </div>
          `;
          const result = parseEpisodePage(html);
          return (
            result.title === title &&
            result.videoSources.length === 1 &&
            result.videoSources[0]?.url === embedUrl &&
            result.videoSources[0]?.type === "embed"
          );
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("parseSeriesHtml PBT", () => {
    it("never crashes with undeclared exceptions for arbitrary HTML", () => {
      fc.assert(
        fc.property(fc.string(), (html) => {
          try {
            const series = otakudesuProvider.parseSeriesHtml(html);
            return (
              typeof series.title === "string" &&
              series.title.length > 0 &&
              Array.isArray(series.episodes)
            );
          } catch (err) {
            return err instanceof SeriesParseError;
          }
        }),
        { numRuns: 150 },
      );
    });

    it("successfully parses synthetic series layout with valid title and episodes", () => {
      const titleArb = fc
        .stringMatching(/^[a-zA-Z0-9 ]{1,30}$/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const epCountArb = fc.integer({ min: 1, max: 10 });

      fc.assert(
        fc.property(titleArb, epCountArb, (title, count) => {
          const epLinks = Array.from(
            { length: count },
            (_, i) =>
              `<li><span><a href="https://otakudesu.cloud/episode/ep-${i + 1}">Episode ${i + 1}</a></span><span class="zeebr">2026-01-01</span></li>`,
          ).join("\n");

          const html = `
            <div class="fotoanime">
              <h1>${title}</h1>
              <img src="https://otakudesu.cloud/poster.jpg" />
            </div>
            <div class="episodelist">
              <ul>${epLinks}</ul>
            </div>
          `;

          const series = otakudesuProvider.parseSeriesHtml(html);
          return (
            series.title === title &&
            series.posterUrl === "https://otakudesu.cloud/poster.jpg" &&
            series.episodes.length === count &&
            series.episodes.every(
              (ep) =>
                ep.url.startsWith("https://otakudesu.cloud/episode/ep-") &&
                ep.title.startsWith("Episode "),
            )
          );
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("parseFullListHtml PBT", () => {
    it("never crashes for arbitrary HTML and always returns deduplicated URLs", () => {
      fc.assert(
        fc.property(fc.string(), (html) => {
          const items = parseFullListHtml(html);
          const urls = items.map((i) => i.url);
          const uniqueUrls = new Set(urls);
          return (
            Array.isArray(items) &&
            urls.length === uniqueUrls.size &&
            items.every(
              (i) =>
                typeof i.title === "string" &&
                i.title.length > 0 &&
                typeof i.url === "string" &&
                i.url.length > 0,
            )
          );
        }),
        { numRuns: 150 },
      );
    });

    it("extracts and deduplicates items from synthetic anime full list HTML", () => {
      const slugArb = fc
        .stringMatching(/^[a-z0-9_-]{2,15}$/)
        .filter((s) => s.length > 0);
      const titleArb = fc
        .stringMatching(/^[a-zA-Z0-9\s]{1,25}$/)
        .map((s) => s.trim() || "Anime Title");

      const itemArb = fc.record({ slug: slugArb, title: titleArb });

      fc.assert(
        fc.property(
          fc.array(itemArb, { minLength: 1, maxLength: 10 }),
          (list) => {
            // Add duplicate of first item to test deduplication
            const fullList = [...list, list[0]!];
            const html = `
            <div class="daftarkartun">
              <div class="jdlbar">
                <ul>
                  ${fullList
                    .map(
                      (item) =>
                        `<li><a href="https://otakudesu.cloud/anime/${item.slug}" title="${item.title} Full">${item.title}</a></li>`,
                    )
                    .join("\n")}
                </ul>
              </div>
            </div>
          `;
            const parsed = parseFullListHtml(html);
            const uniqueCount = new Set(
              fullList.map((i) => `https://otakudesu.cloud/anime/${i.slug}`),
            ).size;
            return (
              parsed.length === uniqueCount &&
              parsed.every((p) =>
                p.url.startsWith("https://otakudesu.cloud/anime/"),
              )
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("extractDirectVideoSources PBT", () => {
    it("never crashes for arbitrary HTML", () => {
      fc.assert(
        fc.property(fc.string(), (html) => {
          const sources = extractDirectVideoSources(html);
          return (
            Array.isArray(sources) &&
            sources.every(
              (s) =>
                s.type === "direct" &&
                typeof s.url === "string" &&
                s.url.length > 0,
            )
          );
        }),
        { numRuns: 150 },
      );
    });

    it("extracts direct mp4 URLs from playerjs script contents", () => {
      const filenameArb = fc
        .stringMatching(/^[a-zA-Z0-9_-]{1,20}$/)
        .filter((f) => f.length > 0);
      const resArb = fc.constantFrom("360p", "480p", "720p", "1080p");

      fc.assert(
        fc.property(filenameArb, resArb, (name, res) => {
          const mp4Url = `https://storage.desustream.net/video/${name}_${res}.mp4`;
          const html = `
            <html>
              <body>
                <script>
                  var player = new Playerjs({
                    file: "${mp4Url}"
                  });
                </script>
              </body>
            </html>
          `;
          const sources = extractDirectVideoSources(html);
          return (
            sources.length >= 1 &&
            sources.some((s) => s.url === mp4Url && s.type === "direct")
          );
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("extractAjaxActions PBT", () => {
    it("never crashes for arbitrary HTML and returns 32-hex tokens or null", () => {
      fc.assert(
        fc.property(fc.string(), (html) => {
          const result = extractAjaxActions(html);
          if (result === null) return true;
          return (
            /^[a-f0-9]{32}$/.test(result.nonceAction) &&
            /^[a-f0-9]{32}$/.test(result.mirrorAction)
          );
        }),
        { numRuns: 150 },
      );
    });

    it("reliably extracts matching 32-char hex nonce and mirror action tokens", () => {
      const hexArb = fc.stringMatching(/^[a-f0-9]{32}$/);

      fc.assert(
        fc.property(hexArb, hexArb, (nonce, mirror) => {
          const script = `
            <script>
              const a = { action: "${nonce}" };
              const b = { nonce: "test", action: "${mirror}" };
            </script>
          `;
          const result = extractAjaxActions(script);
          return (
            result !== null &&
            result.nonceAction === nonce &&
            result.mirrorAction === mirror
          );
        }),
        { numRuns: 100 },
      );
    });
  });
});
