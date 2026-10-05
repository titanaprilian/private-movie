import { describe, expect, it } from "vitest";
import {
  parseBulkScrapedEpisodeNumber,
  stripSeasonDescriptors,
  applySequentialFallback,
} from "../../../src/internal/bulk/index";

describe("bulk title stripping (internal/bulk)", () => {
  it("removes ordinal, part/cour, roman-numeral, and word-form season markers", () => {
    expect(stripSeasonDescriptors("Sousou no Frieren 2nd Season 3")).toBe("Sousou no Frieren 3");
    expect(stripSeasonDescriptors("Kaiju No. 8 Part 2 Ep 4")).toBe("Kaiju No. 8 Ep 4");
    expect(stripSeasonDescriptors("Oshi no Ko Cour 2 5")).toBe("Oshi no Ko 5");
    expect(stripSeasonDescriptors("Attack on Titan Season II Episode 4")).toBe(
      "Attack on Titan Episode 4"
    );
    expect(stripSeasonDescriptors("Mushoku Tensei Second Season 7")).toBe("Mushoku Tensei 7");
    expect(stripSeasonDescriptors("Re:Zero III 6")).toBe("Re:Zero 6");
  });
});

describe("bulk episode number parsing (internal/bulk)", () => {
  it("parses integers, decimals, and ignores season numbers", () => {
    expect(parseBulkScrapedEpisodeNumber("Grand Blue Season 3 Episode 7 Subtitle Indonesia")).toBe(7);
    expect(parseBulkScrapedEpisodeNumber("Aharen-san Episode 7.5 Sub Indo")).toBe(7.5);
    expect(parseBulkScrapedEpisodeNumber("Eps 2.5 Special")).toBe(2.5);
    expect(parseBulkScrapedEpisodeNumber("Sousou no Frieren 2nd Season 3")).toBe(3);
    expect(parseBulkScrapedEpisodeNumber("Kaiju No. 8 Part 2 Ep 4")).toBe(4);
    expect(parseBulkScrapedEpisodeNumber("Attack on Titan Season II Episode 4")).toBe(4);
    expect(parseBulkScrapedEpisodeNumber("Re:Zero III 6")).toBe(6);
  });

  it("returns null when no episode number is present", () => {
    expect(parseBulkScrapedEpisodeNumber("Special OVA")).toBeNull();
    expect(parseBulkScrapedEpisodeNumber("Grand Blue Season 3 Batch")).toBeNull();
  });
});

describe("bulk sequential fallback (internal/bulk)", () => {
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

  it("aligns unmatched integers sequentially and skips decimals/nulls", () => {
    const items = [unmatched(1), unmatched(2), unmatched(7.5), unmatched(null)];
    const result = applySequentialFallback(items, targets);
    expect(result[0]).toMatchObject({ matchedLocalEpisodeId: "ep-1", matchStatus: "matched" });
    expect(result[1]).toMatchObject({ matchedLocalEpisodeId: "ep-2", matchStatus: "matched" });
    expect(result[2].matchedLocalEpisodeId).toBeNull();
    expect(result[3].matchedLocalEpisodeId).toBeNull();
  });
});
