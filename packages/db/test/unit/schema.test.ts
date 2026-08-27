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
    expect(schema.series.type).toBeDefined();
    expect(schema.series.backdropUrl).toBeDefined();
    expect(schema.series.rating).toBeDefined();
    expect(schema.series.tmdbSyncStatus).toBeDefined();
    expect(schema.seasons).toBeDefined();
    expect(schema.seasons.seasonNumber).toBeDefined();
    expect(schema.seasons.seriesId).toBeDefined();
  });

  it("ensures legacy columns are dropped from seasons table", () => {
    expect((schema.seasons as any).backdropUrl).toBeUndefined();
    expect((schema.seasons as any).rating).toBeUndefined();
    expect((schema.seasons as any).tmdbId).toBeUndefined();
    expect((schema.seasons as any).sourceUrl).toBeUndefined();
    expect((schema.seasons as any).source).toBeUndefined();
    expect((schema.seasons as any).tmdbSeason).toBeUndefined();
  });

  it("ensures legacy columns are dropped from episodes table and seasonId is not null", () => {
    expect((schema.episodes as any).tmdbId).toBeUndefined();
    expect((schema.episodes as any).tags).toBeUndefined();
    expect((schema.episodes as any).resolution).toBeUndefined();
    expect((schema.episodes as any).format).toBeUndefined();
    expect((schema.episodes as any).size).toBeUndefined();
    expect((schema.episodes as any).videoType).toBeUndefined();
    expect((schema.episodes as any).metadata).toBeUndefined();

    expect(schema.episodes.seasonId.notNull).toBe(true);
  });
});
