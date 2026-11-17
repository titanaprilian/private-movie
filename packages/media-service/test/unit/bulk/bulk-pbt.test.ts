import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseBulkScrapedEpisodeNumber } from "../../../src/internal/bulk/episode-number";
import { stripSeasonDescriptors } from "../../../src/internal/bulk/title";

describe("Bulk scraper media parsing property-based tests", () => {
  describe("stripSeasonDescriptors PBT", () => {
    it("never crashes for arbitrary strings", () => {
      fc.assert(
        fc.property(fc.string(), (title) => {
          const stripped = stripSeasonDescriptors(title);
          return typeof stripped === "string";
        }),
        { numRuns: 150 },
      );
    });

    it("is strictly idempotent", () => {
      fc.assert(
        fc.property(fc.string(), (title) => {
          const pass1 = stripSeasonDescriptors(title);
          const pass2 = stripSeasonDescriptors(pass1);
          return pass1 === pass2;
        }),
        { numRuns: 150 },
      );
    });

    it("strips standard season markers from titles", () => {
      const descriptorArb = fc.oneof(
        fc.constantFrom(
          "2nd Season",
          "3rd Season",
          "Season 1",
          "Season 02",
          "Season II",
          "Season IV",
          "Part 2",
          "Part II",
          "Cour 1",
          "Cour II",
        ),
        fc.integer({ min: 1, max: 9 }).map((n) => `Season ${n}`),
      );

      const titlePartArb = fc
        .stringMatching(/^[a-zA-Z\s]{1,20}$/)
        .map((s) => s.trim() || "Anime Series");

      fc.assert(
        fc.property(
          titlePartArb,
          descriptorArb,
          titlePartArb,
          (prefix, desc, suffix) => {
            const combined = `${prefix} ${desc} ${suffix}`;
            const stripped = stripSeasonDescriptors(combined);
            // The exact descriptor should no longer appear as a whole phrase
            return !stripped.toLowerCase().includes(desc.toLowerCase());
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("parseBulkScrapedEpisodeNumber PBT", () => {
    it("never crashes and returns finite number or null for arbitrary strings", () => {
      fc.assert(
        fc.property(fc.string(), (raw) => {
          const result = parseBulkScrapedEpisodeNumber(raw);
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

    it("correctly extracts integer episode numbers from standard markers", () => {
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
      const cleanWordArb = fc
        .stringMatching(/^[a-zA-Z\s]{1,20}$/)
        .map((s) => s.trim() || "Anime")
        .filter((s) => !/(?:episode|eps|ep|#|season|s\d+)/i.test(s));

      fc.assert(
        fc.property(
          cleanWordArb,
          markerArb,
          epNumArb,
          cleanWordArb,
          (prefix, marker, epNum, suffix) => {
            const title = `${prefix} ${marker} ${epNum} ${suffix}`;
            const result = parseBulkScrapedEpisodeNumber(title);
            return result === epNum;
          },
        ),
        { numRuns: 150 },
      );
    });

    it("correctly extracts decimal episode numbers (e.g. Episode 5.5 / Ep. 12.5)", () => {
      const epIntArb = fc.integer({ min: 1, max: 500 });
      const epDecArb = fc.constantFrom(5); // .5 special recap / OVA
      const markerArb = fc.constantFrom("Episode", "eps", "Ep.", "#");
      const cleanWordArb = fc
        .stringMatching(/^[a-zA-Z\s]{1,15}$/)
        .map((s) => s.trim() || "Anime")
        .filter((s) => !/(?:episode|eps|ep|#|season|s\d+)/i.test(s));

      fc.assert(
        fc.property(
          cleanWordArb,
          markerArb,
          epIntArb,
          epDecArb,
          (prefix, marker, ep, dec) => {
            const decimalVal = parseFloat(`${ep}.${dec}`);
            const title = `${prefix} ${marker} ${ep}.${dec} Special`;
            const result = parseBulkScrapedEpisodeNumber(title);
            return result !== null && Math.abs(result - decimalVal) < 0.001;
          },
        ),
        { numRuns: 100 },
      );
    });

    it("excludes standalone release years between 1900 and 2100", () => {
      const yearArb = fc.integer({ min: 1900, max: 2100 });
      const cleanTitleArb = fc
        .stringMatching(/^[a-zA-Z\s]{1,20}$/)
        .map((s) => s.trim() || "Movie")
        .filter((s) => !/(?:episode|eps|ep|#|season|s\d+)/i.test(s));

      fc.assert(
        fc.property(cleanTitleArb, yearArb, (title, year) => {
          const fullTitle = `${title} ${year} Movie`;
          const result = parseBulkScrapedEpisodeNumber(fullTitle);
          return result === null;
        }),
        { numRuns: 100 },
      );
    });
  });
});
