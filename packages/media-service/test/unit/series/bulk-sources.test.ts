import { describe, expect, it } from "vitest";
import {
  parseBulkScrapedEpisodeNumber,
  stripSeasonDescriptors,
  applySequentialFallback,
} from "../../../src/index";

describe("parseBulkScrapedEpisodeNumber", () => {
  it("parses integer episode numbers from various title formats", () => {
    expect(parseBulkScrapedEpisodeNumber("Grand Blue Season 3 Episode 7 Subtitle Indonesia")).toBe(7);
    expect(parseBulkScrapedEpisodeNumber("Episode 01 Sub Indo")).toBe(1);
    expect(parseBulkScrapedEpisodeNumber("Eps 12")).toBe(12);
    expect(parseBulkScrapedEpisodeNumber("Ep. 5")).toBe(5);
    expect(parseBulkScrapedEpisodeNumber("Anime Name #10")).toBe(10);
    expect(parseBulkScrapedEpisodeNumber("Series Season 2 Ep 3 Sub Indo")).toBe(3);
  });

  it("parses decimal episode numbers correctly", () => {
    expect(parseBulkScrapedEpisodeNumber("Aharen-san Episode 7.5 Sub Indo")).toBe(7.5);
    expect(parseBulkScrapedEpisodeNumber("Episode 07.5")).toBe(7.5);
    expect(parseBulkScrapedEpisodeNumber("Eps 2.5 Special")).toBe(2.5);
    expect(parseBulkScrapedEpisodeNumber("Recap 7.5")).toBe(7.5);
  });

  it("returns null when no episode number is present", () => {
    expect(parseBulkScrapedEpisodeNumber("Special OVA")).toBeNull();
    expect(parseBulkScrapedEpisodeNumber("Grand Blue Season 3 Batch")).toBeNull();
  });

  it("ignores season descriptors and extracts the episode number", () => {
    // Ordinal season suffixes
    expect(parseBulkScrapedEpisodeNumber("Sousou no Frieren 2nd Season 3")).toBe(3);
    expect(parseBulkScrapedEpisodeNumber("KonoSuba 3rd Season Ep 2")).toBe(2);
    // Part / Cour suffixes
    expect(parseBulkScrapedEpisodeNumber("Kaiju No. 8 Part 2 Ep 4")).toBe(4);
    expect(parseBulkScrapedEpisodeNumber("Oshi no Ko Cour 2 5")).toBe(5);
    // Roman numerals
    expect(parseBulkScrapedEpisodeNumber("Attack on Titan Season II Episode 4")).toBe(4);
    expect(parseBulkScrapedEpisodeNumber("Re:Zero III 6")).toBe(6);
    // Word-form ordinals
    expect(parseBulkScrapedEpisodeNumber("Mushoku Tensei Second Season 7")).toBe(7);
  });
});

describe("stripSeasonDescriptors", () => {
  it("removes season markers while keeping episode numbers", () => {
    expect(stripSeasonDescriptors("Sousou no Frieren 2nd Season 3")).toBe("Sousou no Frieren 3");
    expect(stripSeasonDescriptors("Kaiju No. 8 Part 2 Ep 4")).toBe("Kaiju No. 8 Ep 4");
    expect(stripSeasonDescriptors("Oshi no Ko Cour 2 5")).toBe("Oshi no Ko 5");
    expect(stripSeasonDescriptors("Attack on Titan Season II Episode 4")).toBe(
      "Attack on Titan Episode 4"
    );
  });
});

describe("applySequentialFallback", () => {
  const targets = [
    { id: "ep-1", order: 1 },
    { id: "ep-2", order: 2 },
    { id: "ep-3", order: 3 },
  ];

  const unmatched = (n: number | null) => ({
    episodeNumber: n,
    calculatedOrder: n,
    matchedLocalEpisodeId: null as string | null,
    matchStatus: "unmatched" as const,
  });

  it("maps unmatched integer episodes to the next unclaimed target in order", () => {
    const items = [unmatched(1), unmatched(2)];
    const result = applySequentialFallback(items, targets);
    expect(result[0].matchedLocalEpisodeId).toBe("ep-1");
    expect(result[0].calculatedOrder).toBe(1);
    expect(result[0].matchStatus).toBe("matched");
    expect(result[1].matchedLocalEpisodeId).toBe("ep-2");
  });

  it("skips already-claimed targets and leaves non-integers unmapped", () => {
    const items = [
      {
        episodeNumber: 1,
        calculatedOrder: 1,
        matchedLocalEpisodeId: "ep-1",
        matchStatus: "matched" as const,
      },
      unmatched(2),
      unmatched(7.5),
      unmatched(null),
    ];
    const result = applySequentialFallback(items, targets);
    expect(result[0].matchedLocalEpisodeId).toBe("ep-1");
    expect(result[1].matchedLocalEpisodeId).toBe("ep-2");
    expect(result[2].matchedLocalEpisodeId).toBeNull();
    expect(result[2].matchStatus).toBe("unmatched");
    expect(result[3].matchedLocalEpisodeId).toBeNull();
  });

  it("leaves excess items unmapped when targets run out", () => {
    const items = [unmatched(1), unmatched(2), unmatched(3), unmatched(4)];
    const result = applySequentialFallback(items, targets.slice(0, 2));
    expect(result[0].matchedLocalEpisodeId).toBe("ep-1");
    expect(result[1].matchedLocalEpisodeId).toBe("ep-2");
    expect(result[2].matchedLocalEpisodeId).toBeNull();
    expect(result[3].matchedLocalEpisodeId).toBeNull();
  });
});
