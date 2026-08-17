import { beforeEach, describe, expect, it } from "vitest";
import { episodes, series } from "@repo/db";
import { createSeriesRepositoryInternal } from "@/modules/media/internal/series/repository";
import { db } from "../../utils/db";

async function insertSeries(overrides?: {
  title?: string;
  source?: string;
  sourceUrl?: string;
  createdAt?: Date;
}): Promise<{ id: string; title: string }> {
  const id = crypto.randomUUID();
  const sourceUrl =
    overrides?.sourceUrl ?? `https://otakudesu.blog/anime/series-${id}/`;
  const title = overrides?.title ?? `Series ${id}`;
  const source = overrides?.source ?? "otakudesu";
  const now = overrides?.createdAt ?? new Date();

  const [row] = await db
    .insert(series)
    .values({
      id,
      sourceUrl,
      source,
      title,
      description: "Test Description",
      posterUrl: "https://example.com/poster.jpg",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

async function insertEpisodeForSeries(
  seriesId: string,
  overrides?: { title?: string; createdAt?: Date }
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const now = overrides?.createdAt ?? new Date();

  const [row] = await db
    .insert(episodes)
    .values({
      id,
      sourceUrl: `https://otakudesu.blog/episode/ep-${id}/`,
      source: "otakudesu",
      title: overrides?.title ?? "Episode Title",
      videoType: null,
      metadata: {},
      seriesId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

describe("series repository list", () => {
  const repository = createSeriesRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(series);
  });

  it("returns paginated series list with total count and ordering by createdAt desc", async () => {
    const s1 = await insertSeries({
      title: "First Series",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const s2 = await insertSeries({
      title: "Second Series",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    const s3 = await insertSeries({
      title: "Third Series",
      createdAt: new Date("2026-08-03T00:00:00.000Z"),
    });

    const page1 = await repository.list({ page: 1, limit: 2 });
    expect(page1.total).toBe(3);
    expect(page1.series).toHaveLength(2);
    expect(page1.series[0].id).toBe(s3.id);
    expect(page1.series[1].id).toBe(s2.id);

    const page2 = await repository.list({ page: 2, limit: 2 });
    expect(page2.total).toBe(3);
    expect(page2.series).toHaveLength(1);
    expect(page2.series[0].id).toBe(s1.id);
  });

  it("filters by source when source param is provided", async () => {
    await insertSeries({ source: "otakudesu" });

    const filtered = await repository.list({ page: 1, limit: 10, source: "otakudesu" });
    expect(filtered.total).toBe(1);
    expect(filtered.series[0].source).toBe("otakudesu");
  });
});

describe("series repository findByIdWithEpisodes", () => {
  const repository = createSeriesRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(series);
  });

  it("returns series row along with child episodes array ordered by order asc then createdAt asc", async () => {
    const s = await insertSeries({ title: "Parent Series" });
    const ep1 = await insertEpisodeForSeries(s.id, {
      title: "Episode 1",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const ep2 = await insertEpisodeForSeries(s.id, {
      title: "Episode 2",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const result = await repository.findByIdWithEpisodes(s.id);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(s.id);
    expect(result?.title).toBe("Parent Series");
    expect(result?.episodes).toHaveLength(2);
    expect(result?.episodes[0].id).toBe(ep1.id);
    expect(result?.episodes[1].id).toBe(ep2.id);
  });

  it("returns series with empty episodes array if series has no episodes", async () => {
    const s = await insertSeries({ title: "Empty Series" });

    const result = await repository.findByIdWithEpisodes(s.id);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(s.id);
    expect(result?.episodes).toEqual([]);
  });

  it("returns null if series ID does not exist", async () => {
    const result = await repository.findByIdWithEpisodes(crypto.randomUUID());
    expect(result).toBeNull();
  });
});

describe("series repository updateSeries", () => {
  const repository = createSeriesRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(series);
  });

  it("partially updates series fields and returns updated row", async () => {
    const s = await insertSeries({ title: "Original Title" });

    const updated = await repository.updateSeries(s.id, {
      title: "Updated Title",
      description: "New Description",
      posterUrl: "https://example.com/new-poster.jpg",
    });

    expect(updated.id).toBe(s.id);
    expect(updated.title).toBe("Updated Title");
    expect(updated.description).toBe("New Description");
    expect(updated.posterUrl).toBe("https://example.com/new-poster.jpg");
  });

  it("throws SeriesNotFoundError when updating non-existent series", async () => {
    await expect(
      repository.updateSeries(crypto.randomUUID(), { title: "New Title" })
    ).rejects.toThrow("Series with id");
  });
});

describe("series repository deleteSeries", () => {
  const repository = createSeriesRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(series);
  });

  it("hard-deletes an existing series and returns deleted row", async () => {
    const s = await insertSeries({ title: "To Be Deleted" });

    const deleted = await repository.deleteSeries(s.id);

    expect(deleted.id).toBe(s.id);
    expect(deleted.title).toBe("To Be Deleted");

    const found = await repository.findById(s.id);
    expect(found).toBeNull();
  });

  it("unlinks child episodes before deleting series", async () => {
    const s = await insertSeries({ title: "Series with Episode" });
    await insertEpisodeForSeries(s.id, { title: "Child Episode" });

    const deleted = await repository.deleteSeries(s.id);

    expect(deleted.id).toBe(s.id);

    const found = await repository.findById(s.id);
    expect(found).toBeNull();
  });

  it("throws SeriesNotFoundError when deleting non-existent series", async () => {
    await expect(
      repository.deleteSeries(crypto.randomUUID())
    ).rejects.toThrow("Series with id");
  });
});
