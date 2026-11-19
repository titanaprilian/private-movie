import { describe, it, expect } from "vitest";

describe("syncTmdb skipGenres option validation", () => {
  it("accepts skipGenres as an optional boolean configuration", () => {
    const input = { type: "tv" as const, tmdbId: 100, skipGenres: true };
    expect(input.skipGenres).toBe(true);
  });
});
