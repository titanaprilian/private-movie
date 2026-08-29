import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { createSeriesRepositoryInternal } from "@repo/media-service";
import { db } from "../../utils/db";

async function insertSeries(overrides?: {
  title?: string;
  description?: string | null;
  createdAt?: Date;
}): Promise<{ id: string; title: string }> {
  const id = crypto.randomUUID();
  const title = overrides?.title ?? `Series ${id}`;
  const description = overrides?.description !== undefined ? overrides.description : "Test Description";
  const now = overrides?.createdAt ?? new Date();

  const [row] = await db
    .insert(series)
    .values({
      id,
      title,
      description,
      posterUrl: "https://example.com/poster.jpg",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db
    .insert(seasons)
    .values({
      id: crypto.randomUUID(),
      seriesId: id,
      title,
      description,
      posterUrl: "https://example.com/poster.jpg",
      createdAt: now,
      updatedAt: now,
    });

  return row;
}

async function insertEpisodeForSeries(
  seriesId: string,
  overrides?: { title?: string; createdAt?: Date; order?: number }
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const now = overrides?.createdAt ?? new Date();

  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.seriesId, seriesId));

  let seasonId = season?.id;
  if (!seasonId) {
    const [newSeason] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId,
        title: "Season Title",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    seasonId = newSeason.id;
  }

  let order = overrides?.order;
  if (order === undefined) {
    const existingEps = await db
      .select()
      .from(episodes)
      .where(eq(episodes.seasonId, seasonId));
    order = existingEps.length + 1;
  }

  const [row] = await db
    .insert(episodes)
    .values({
      id,
      title: overrides?.title ?? "Episode Title",
      order,
      seasonId,
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
    await db.delete(seasons);
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
    expect(page1.series[0].seasons).toHaveLength(1);
    expect(page1.series[0].seasons[0].seriesId).toBe(s3.id);
    expect(page1.series[1].id).toBe(s2.id);

    const page2 = await repository.list({ page: 2, limit: 2 });
    expect(page2.total).toBe(3);
    expect(page2.series).toHaveLength(1);
    expect(page2.series[0].id).toBe(s1.id);
  });

  it("filters by q parameter matching title or description case-insensitively", async () => {
    await insertSeries({ title: "Naruto Shippuden", description: "Ninja adventures" });
    await insertSeries({ title: "One Piece", description: "Pirate king search for treasure" });
    await insertSeries({ title: "Bleach", description: "Soul Reaper story" });

    const titleMatch = await repository.list({ page: 1, limit: 10, q: "naruto" });
    expect(titleMatch.total).toBe(1);
    expect(titleMatch.series[0].title).toBe("Naruto Shippuden");

    const descMatch = await repository.list({ page: 1, limit: 10, q: "TREASURE" });
    expect(descMatch.total).toBe(1);
    expect(descMatch.series[0].title).toBe("One Piece");

    const noMatch = await repository.list({ page: 1, limit: 10, q: "nonexistent" });
    expect(noMatch.total).toBe(0);
    expect(noMatch.series).toHaveLength(0);
  });
});

describe("series repository findByIdWithEpisodes", () => {
  const repository = createSeriesRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(seasons);
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
    expect(result?.seasons).toHaveLength(1);
    expect(result?.seasons[0].episodes).toHaveLength(2);
    expect(result?.seasons[0].episodes[0].id).toBe(ep1.id);
    expect(result?.seasons[0].episodes[1].id).toBe(ep2.id);
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

  it("sorts seasons by seasonNumber priority [regular ASC -> 0 -> null] and then createdAt ASC", async () => {
    const s = await insertSeries({ title: "Multi Season Series" });
    const now = new Date();

    await db.delete(seasons).where(eq(seasons.seriesId, s.id));

    await db.insert(seasons).values([
      {
        id: crypto.randomUUID(),
        seriesId: s.id,
        title: "Season 3",
        seasonNumber: 3,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        seriesId: s.id,
        title: "Unmapped Season",
        seasonNumber: null,
        createdAt: new Date("2026-01-04T00:00:00.000Z"),
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        seriesId: s.id,
        title: "Specials",
        seasonNumber: 0,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        seriesId: s.id,
        title: "Season 1",
        seasonNumber: 1,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: now,
      },
    ]);

    const result = await repository.findByIdWithEpisodes(s.id);
    expect(result).not.toBeNull();
    expect(result?.seasons.map((season) => season.seasonNumber)).toEqual([1, 3, 0, null]);
    expect(result?.seasons.map((season) => season.title)).toEqual([
      "Season 1",
      "Season 3",
      "Specials",
      "Unmapped Season",
    ]);
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
    await db.delete(seasons);
    await db.delete(series);
  });

  it("partially updates series fields and returns updated row", async () => {
    const s = await insertSeries({ title: "Original Title" });

    const updated = await repository.updateSeries(s.id, {
      title: "Updated Title",
      description: "New Description",
      posterUrl: "https://example.com/new-poster.jpg",
      status: "ongoing",
      isFeatured: true,
    });

    expect(updated.id).toBe(s.id);
    expect(updated.title).toBe("Updated Title");
    expect(updated.description).toBe("New Description");
    expect(updated.posterUrl).toBe("https://example.com/new-poster.jpg");
    expect(updated.status).toBe("ongoing");
    expect(updated.isFeatured).toBe(true);
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
    await db.delete(seasons);
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
