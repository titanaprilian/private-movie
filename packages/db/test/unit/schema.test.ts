import { describe, expect, it } from "vitest";
import * as schema from "../../src/schema";

describe("db schema exports", () => {
  it("exports schema definitions", () => {
    expect(schema).toBeDefined();
    expect(schema.videoSources).toBeDefined();
    expect(schema.genres).toBeDefined();
    expect(schema.seriesToGenres).toBeDefined();
    expect(schema.series).toBeDefined();
    expect(schema.series.tmdbId).toBeDefined();
    expect(schema.series.tmdbSeason).toBeDefined();
    expect(schema.series.backdropUrl).toBeDefined();
    expect(schema.series.rating).toBeDefined();
    expect(schema.series.tmdbSyncStatus).toBeDefined();
  });
});
