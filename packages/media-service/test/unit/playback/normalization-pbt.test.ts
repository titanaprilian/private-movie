import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  normalizePlaybackUrl,
  parseVideoQuality,
  sortVideoSources,
} from "../../../src/internal/playback/normalization";

describe("Playback normalization property-based tests", () => {
  describe("normalizePlaybackUrl PBT", () => {
    it("never crashes for arbitrary strings", () => {
      fc.assert(
        fc.property(fc.string(), (url) => {
          const result = normalizePlaybackUrl(url);
          return typeof result === "string";
        }),
        { numRuns: 150 },
      );
    });

    it("is strictly idempotent for any input URL", () => {
      fc.assert(
        fc.property(fc.string(), (url) => {
          const pass1 = normalizePlaybackUrl(url);
          const pass2 = normalizePlaybackUrl(pass1);
          return pass1 === pass2;
        }),
        { numRuns: 150 },
      );
    });

    it("passes through internal proxy and embed URLs unmodified", () => {
      const internalArb = fc.oneof(
        fc.stringMatching(/^\/embed\/[a-zA-Z0-9_\-?&=]+$/),
        fc.stringMatching(/^\/api\/media\/proxy-embed\?url=[a-zA-Z0-9_%.\-]+$/),
      );

      fc.assert(
        fc.property(internalArb, (internalUrl) => {
          return normalizePlaybackUrl(internalUrl) === internalUrl;
        }),
        { numRuns: 100 },
      );
    });

    it("normalizes videobello.net embed links to internal /embed/{hash}", () => {
      const hashArb = fc.stringMatching(/^[a-zA-Z0-9]{6,16}$/);

      fc.assert(
        fc.property(hashArb, (hash) => {
          const url = `https://videobello.net/embed/${hash}?autoplay=1`;
          const result = normalizePlaybackUrl(url);
          return result === `/embed/${hash}?autoplay=1`;
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("parseVideoQuality PBT", () => {
    it("always returns non-negative finite integer for arbitrary string/null/undefined", () => {
      fc.assert(
        fc.property(fc.option(fc.string(), { nil: undefined }), (quality) => {
          const parsed = parseVideoQuality(quality);
          return (
            typeof parsed === "number" &&
            !Number.isNaN(parsed) &&
            Number.isFinite(parsed) &&
            parsed >= 0 &&
            Number.isInteger(parsed)
          );
        }),
        { numRuns: 150 },
      );
    });

    it("correctly extracts integer resolution from standard quality tags", () => {
      const resNumArb = fc.integer({ min: 144, max: 4320 });
      const tagSuffixArb = fc.constantFrom("p", "P");
      const padArb = fc.stringMatching(/^[a-zA-Z\s_-]{0,10}$/);

      fc.assert(
        fc.property(
          padArb,
          resNumArb,
          tagSuffixArb,
          padArb,
          (prefix, num, tag, suffix) => {
            const str = `${prefix} ${num}${tag} ${suffix}`.trim();
            const parsed = parseVideoQuality(str);
            return parsed === num;
          },
        ),
        { numRuns: 150 },
      );
    });
  });

  describe("sortVideoSources PBT", () => {
    const videoSourceArb = fc.record({
      id: fc.uuid(),
      type: fc.oneof(
        fc.constantFrom("s3", "direct", "embed"),
        fc.stringMatching(/^[a-z]{3,10}$/),
      ),
      quality: fc.oneof(
        fc.constantFrom("360p", "480p", "720p", "1080p", "2160p", null),
        fc.string(),
      ),
      createdAt: fc.oneof(
        fc
          .integer({ min: 0, max: 2_000_000_000_000 })
          .map((t) => new Date(t).toISOString()),
        fc.constant(null),
      ),
    });

    it("never crashes and preserves array length", () => {
      fc.assert(
        fc.property(fc.array(videoSourceArb, { maxLength: 20 }), (sources) => {
          const sorted = sortVideoSources(sources);
          return sorted.length === sources.length;
        }),
        { numRuns: 100 },
      );
    });

    it("strictly respects tier priority: s3 > direct > embed > unknown", () => {
      const tierRank = (type?: string) => {
        if (type === "s3") return 0;
        if (type === "direct") return 1;
        if (type === "embed") return 2;
        return 99;
      };

      fc.assert(
        fc.property(fc.array(videoSourceArb, { maxLength: 20 }), (sources) => {
          const sorted = sortVideoSources(sources);
          for (let i = 0; i < sorted.length - 1; i++) {
            const rankCurr = tierRank(sorted[i]?.type);
            const rankNext = tierRank(sorted[i + 1]?.type);
            if (rankCurr > rankNext) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 100 },
      );
    });

    it("breaks ties within identical tier by parsed resolution descending", () => {
      const sameTierArb = fc.array(
        fc.record({
          id: fc.uuid(),
          type: fc.constant("direct"),
          quality: fc.constantFrom(
            "360p",
            "480p",
            "720p",
            "1080p",
            "2160p",
            null,
          ),
          createdAt: fc
            .integer({ min: 0, max: 2_000_000_000_000 })
            .map((t) => new Date(t).toISOString()),
        }),
        { maxLength: 15 },
      );

      fc.assert(
        fc.property(sameTierArb, (sources) => {
          const sorted = sortVideoSources(sources);
          for (let i = 0; i < sorted.length - 1; i++) {
            const qCurr = parseVideoQuality(sorted[i]?.quality);
            const qNext = parseVideoQuality(sorted[i + 1]?.quality);
            if (qCurr < qNext) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 100 },
      );
    });

    it("is strictly idempotent", () => {
      fc.assert(
        fc.property(fc.array(videoSourceArb, { maxLength: 15 }), (sources) => {
          const sortedOnce = sortVideoSources(sources);
          const sortedTwice = sortVideoSources(sortedOnce);
          return (
            sortedOnce.length === sortedTwice.length &&
            sortedOnce.every((s, idx) => s.id === sortedTwice[idx]?.id)
          );
        }),
        { numRuns: 100 },
      );
    });
  });
});
