import { describe, expect, it } from "vitest";
import { compareSeasons } from "../../../src/internal/series/repository";

describe("compareSeasons", () => {
  it("sorts seasons in exact order: regular seasons ASC -> seasonNumber = 0 -> seasonNumber = null -> createdAt ASC fallback", () => {
    const s3 = { id: "s3", seasonNumber: 3, createdAt: new Date("2026-01-01") };
    const s1 = { id: "s1", seasonNumber: 1, createdAt: new Date("2026-01-01") };
    const s0 = { id: "s0", seasonNumber: 0, createdAt: new Date("2026-01-01") };
    const sNull1 = {
      id: "sNull1",
      seasonNumber: null,
      createdAt: new Date("2026-01-02"),
    };
    const sNull2 = {
      id: "sNull2",
      seasonNumber: null,
      createdAt: new Date("2026-01-01"),
    };

    const seasonList = [s3, sNull1, s0, s1, sNull2];
    seasonList.sort(compareSeasons);

    expect(seasonList.map((s) => s.seasonNumber)).toEqual([
      1,
      3,
      0,
      null,
      null,
    ]);
    expect(seasonList.map((s) => s.id)).toEqual([
      "s1",
      "s3",
      "s0",
      "sNull2",
      "sNull1",
    ]);
  });
});
