import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { createSeasonRepository } from "@/modules/seasons/internal/repository";
import {
  SeasonAlreadyExistsError,
  SeasonNotEmptyError,
  SeasonNotFoundError,
} from "@/modules/seasons/internal/errors";
import { db } from "../../utils/db";

async function createSeriesWithTitle(title = "Series 1"): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(series).values({ id, title, createdAt: now, updatedAt: now });
  return id;
}

describe("season repository create", () => {
  const repository = createSeasonRepository(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("creates a season with defaults", async () => {
    const seriesId = await createSeriesWithTitle();
    const row = await repository.create({ seriesId, title: "Season 1", seasonNumber: 1 });

    expect(row.seriesId).toBe(seriesId);
    expect(row.title).toBe("Season 1");
    expect(row.seasonNumber).toBe(1);

    const found = await repository.findById(row.id);
    expect(found?.id).toBe(row.id);
  });

  it("throws SeasonAlreadyExistsError on duplicate season number", async () => {
    const seriesId = await createSeriesWithTitle();
    await repository.create({ seriesId, title: "Season 1", seasonNumber: 1 });

    await expect(
      repository.create({ seriesId, title: "Season 1 dup", seasonNumber: 1 }),
    ).rejects.toBeInstanceOf(SeasonAlreadyExistsError);
  });

  it("demotes sibling ongoing seasons when creating an ongoing season", async () => {
    const seriesId = await createSeriesWithTitle();
    const first = await repository.create({
      seriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "ongoing",
    });
    const second = await repository.create({
      seriesId,
      title: "Season 2",
      seasonNumber: 2,
      status: "ongoing",
    });

    const [refreshedFirst] = await db.select().from(seasons).where(eq(seasons.id, first.id));
    expect(refreshedFirst.status).toBe("completed");
    expect(second.status).toBe("ongoing");
  });

  it("finds by series id and season number", async () => {
    const seriesId = await createSeriesWithTitle();
    const created = await repository.create({ seriesId, title: "S1", seasonNumber: 3 });

    const found = await repository.findBySeriesIdAndSeasonNumber(seriesId, 3);
    expect(found?.id).toBe(created.id);

    const missing = await repository.findBySeriesIdAndSeasonNumber(seriesId, 99);
    expect(missing).toBeNull();
  });

  it("finds ongoing seasons with scraper url", async () => {
    const seriesId = await createSeriesWithTitle();
    await repository.create({ seriesId, title: "No scraper", seasonNumber: 1, status: "ongoing" });
    const withScraper = await repository.create({
      seriesId,
      title: "With scraper",
      seasonNumber: 2,
      status: "completed",
      scraperUrl: "https://example.com/s",
      source: "example",
    });
    await repository.updateSeason(withScraper.id, { status: "ongoing" });

    const rows = await repository.findOngoingWithScraperUrl();
    expect(rows.map((r) => r.id)).toContain(withScraper.id);
  });
});

describe("season repository updateSeason", () => {
  const repository = createSeasonRepository(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("throws SeasonNotFoundError for unknown id", async () => {
    await expect(
      repository.updateSeason(crypto.randomUUID(), { title: "x" }),
    ).rejects.toBeInstanceOf(SeasonNotFoundError);
  });

  it("demotes siblings when updating a season to ongoing", async () => {
    const seriesId = await createSeriesWithTitle();
    const first = await repository.create({
      seriesId,
      title: "S1",
      seasonNumber: 1,
      status: "ongoing",
    });
    const second = await repository.create({ seriesId, title: "S2", seasonNumber: 2 });

    await repository.updateSeason(second.id, { status: "ongoing" });

    const [refreshedFirst] = await db.select().from(seasons).where(eq(seasons.id, first.id));
    const [refreshedSecond] = await db.select().from(seasons).where(eq(seasons.id, second.id));
    expect(refreshedFirst.status).toBe("completed");
    expect(refreshedSecond.status).toBe("ongoing");
  });

  it("clears series highlight when last ongoing season completes", async () => {
    const seriesId = await createSeriesWithTitle();
    await db.update(series).set({ isOngoingHighlighted: true }).where(eq(series.id, seriesId));
    const only = await repository.create({
      seriesId,
      title: "S1",
      seasonNumber: 1,
      status: "ongoing",
    });

    await repository.updateSeason(only.id, { status: "completed" });

    const [refreshed] = await db.select().from(series).where(eq(series.id, seriesId));
    expect(refreshed.isOngoingHighlighted).toBe(false);
  });

  it("reparents seasons between series", async () => {
    const fromId = await createSeriesWithTitle("From");
    const toId = await createSeriesWithTitle("To");
    await repository.create({ seriesId: fromId, title: "S1", seasonNumber: 1 });

    await repository.reparentSeasons(fromId, toId);

    const rows = await db.select().from(seasons).where(eq(seasons.seriesId, toId));
    expect(rows).toHaveLength(1);
  });
});

describe("season repository deleteSeason", () => {
  const repository = createSeasonRepository(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("throws SeasonNotFoundError for unknown id", async () => {
    await expect(repository.deleteSeason(crypto.randomUUID())).rejects.toBeInstanceOf(
      SeasonNotFoundError,
    );
  });

  it("throws SeasonNotEmptyError when episodes remain", async () => {
    const seriesId = await createSeriesWithTitle();
    const season = await repository.create({ seriesId, title: "S1", seasonNumber: 1 });
    const now = new Date();
    await db.insert(episodes).values({
      id: crypto.randomUUID(),
      title: "Ep 1",
      order: 1,
      seasonId: season.id,
      createdAt: now,
      updatedAt: now,
    });

    await expect(repository.deleteSeason(season.id)).rejects.toBeInstanceOf(SeasonNotEmptyError);
  });

  it("deletes an empty season and clears highlight if it was ongoing", async () => {
    const seriesId = await createSeriesWithTitle();
    await db.update(series).set({ isOngoingHighlighted: true }).where(eq(series.id, seriesId));
    const season = await repository.create({
      seriesId,
      title: "S1",
      seasonNumber: 1,
      status: "ongoing",
    });

    await repository.deleteSeason(season.id);

    const found = await repository.findById(season.id);
    expect(found).toBeNull();
    const [refreshed] = await db.select().from(series).where(eq(series.id, seriesId));
    expect(refreshed.isOngoingHighlighted).toBe(false);
  });
});
