import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  extractQualityFromLabel,
  parseEpisodeOrder,
  QUALITY_PATTERN,
} from "../../../src";

describe("Otakudesu property-based tests", () => {
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
});
