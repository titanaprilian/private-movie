import { describe, expect, it } from "vitest";
import { parseBulkScrapedEpisodeNumber } from "../../../src/index";

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
});
