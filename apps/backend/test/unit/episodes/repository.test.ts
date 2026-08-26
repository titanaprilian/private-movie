import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { createEpisodeRepositoryInternal } from "@repo/media-service";
import { db } from "../../utils/db";

async function createTestSeason(id = "season-1"): Promise<string> {
  const now = new Date();
  const [sRow] = await db
    .insert(series)
    .values({
      id: crypto.randomUUID(),
      title: "Series 1",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [seasonRow] = await db
    .insert(seasons)
    .values({
      id,
      seriesId: sRow.id,
      sourceUrl: `https://otakudesu.blog/anime/season-${id}-${crypto.randomUUID()}`,
      source: "otakudesu",
      title: "Season 1",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return seasonRow.id;
}

async function insertEpisode(order = 1, seasonId: string | null = null): Promise<{ id: string }> {
  const now = new Date();
  const rows = await db
    .insert(episodes)
    .values({
      id: crypto.randomUUID(),
      title: "original-title",
      order,
      seasonId,
      videoType: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0];
}

describe("episode repository upsert", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("inserts new episode and updates on conflict targeting seasonId and order", async () => {
    const seasonId = await createTestSeason("season-100");
    const airDate = new Date("2022-04-02T00:00:00.000Z");
    const row = await repository.upsert({
      seasonId,
      order: 1,
      title: "Episode 1",
      duration: 24,
      tmdbId: 12345,
      thumbnailUrl: "https://example.com/thumb.jpg",
      rating: "8.5",
      airDate,
    });

    expect(row.title).toBe("Episode 1");
    expect(row.duration).toBe(24);
    expect(row.tmdbId).toBe(12345);
    expect(row.thumbnailUrl).toBe("https://example.com/thumb.jpg");
    expect(row.rating).toBe("8.5");
    expect(row.airDate?.toISOString()).toBe(airDate.toISOString());

    // Conflict update on (seasonId, order)
    const updated = await repository.upsert({
      seasonId,
      order: 1,
      title: "Episode 1 Updated",
      duration: 25,
    });

    expect(updated.id).toBe(row.id);
    expect(updated.title).toBe("Episode 1 Updated");
    expect(updated.duration).toBe(25);
  });
});

describe("episode repository deleteEpisode", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("hard-deletes an existing episode and returns the deleted row", async () => {
    const existing = await insertEpisode(1);

    const deleted = await repository.deleteEpisode(existing.id);

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(existing.id);
    expect(deleted.title).toBe("original-title");

    const remaining = await db
      .select()
      .from(episodes)
      .where(eq(episodes.id, existing.id));
    expect(remaining).toHaveLength(0);
  });

  it("throws an explicit error when the episode id does not exist", async () => {
    const missingId = crypto.randomUUID();

    const result = repository.deleteEpisode(missingId);
    await expect(result).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Error && error.name === "EpisodeNotFoundError"
    );
  });
});

describe("episode repository updateEpisode", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
  });

  it("partially updates episode title and description and returns updated row", async () => {
    const existing = await insertEpisode(10);

    // Update title only
    const updatedTitle = await repository.updateEpisode(existing.id, {
      title: "Updated Title",
    });
    expect(updatedTitle.title).toBe("Updated Title");

    // Update description only
    const updatedDesc = await repository.updateEpisode(existing.id, {
      description: "Updated episode description",
    });
    expect(updatedDesc.description).toBe("Updated episode description");

    // Clear description with null
    const clearedDesc = await repository.updateEpisode(existing.id, {
      description: null,
    });
    expect(clearedDesc.description).toBeNull();

    // Update all allowed fields
    const updatedAll = await repository.updateEpisode(existing.id, {
      title: "Final Title",
      description: "Final Description",
    });
    expect(updatedAll.title).toBe("Final Title");
    expect(updatedAll.description).toBe("Final Description");
  });

  it("throws EpisodeNotFoundError when updating a non-existent episode id", async () => {
    const missingId = crypto.randomUUID();

    const result = repository.updateEpisode(missingId, {
      title: "Should Fail",
    });
    await expect(result).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Error && error.name === "EpisodeNotFoundError"
    );
  });
});

describe("episode repository updateOrders", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
  });

  it("updates order for multiple episodes in a transaction", async () => {
    const ep1 = await insertEpisode(1);
    const ep2 = await insertEpisode(2);

    await repository.updateOrders([
      { id: ep1.id, order: 5 },
      { id: ep2.id, order: 10 },
    ]);

    const updated1 = await db.select().from(episodes).where(eq(episodes.id, ep1.id));
    const updated2 = await db.select().from(episodes).where(eq(episodes.id, ep2.id));

    expect(updated1[0].order).toBe(5);
    expect(updated2[0].order).toBe(10);
  });

  it("rolls back transaction if any episode in batch does not exist", async () => {
    const ep1 = await insertEpisode(1);
    const initialEp1 = await db.select().from(episodes).where(eq(episodes.id, ep1.id));
    const initialOrder = initialEp1[0].order;

    const missingId = crypto.randomUUID();

    await expect(
      repository.updateOrders([
        { id: ep1.id, order: 99 },
        { id: missingId, order: 100 },
      ])
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Error && error.name === "EpisodeNotFoundError"
    );

    const checkEp1 = await db.select().from(episodes).where(eq(episodes.id, ep1.id));
    expect(checkEp1[0].order).toBe(initialOrder);
  });

  it("re-parents an episode into another season via seasonId in the payload", async () => {
    const seasonA = await createTestSeason("repo-season-a");
    const seasonB = await createTestSeason("repo-season-b");
    const epInA = await insertEpisode(1, seasonA);
    const otherInB = await insertEpisode(1, seasonB);

    // Target (seasonB, 2) is free — simple append-style migration.
    await repository.updateOrders([
      { id: epInA.id, order: 2, seasonId: seasonB },
    ]);

    const [moved] = await db.select().from(episodes).where(eq(episodes.id, epInA.id));
    expect(moved.seasonId).toBe(seasonB);
    expect(moved.order).toBe(2);

    const [untouched] = await db.select().from(episodes).where(eq(episodes.id, otherInB.id));
    expect(untouched.seasonId).toBe(seasonB);
    expect(untouched.order).toBe(1);
  });

  it("handles colliding orders across seasons without unique constraint violations", async () => {
    const seasonA = await createTestSeason("repo-season-c");
    const seasonB = await createTestSeason("repo-season-d");
    const epA1 = await insertEpisode(1, seasonA);
    const epA2 = await insertEpisode(2, seasonA);
    const epB1 = await insertEpisode(1, seasonB);

    // Swap epB1 into season A slot 1 while epA1 still occupies (A, 1), and
    // push epA1 to slot 2 where epA2 currently sits. Only a parking phase
    // that defers re-parenting until all rows hold negative orders survives.
    await repository.updateOrders([
      { id: epB1.id, order: 1, seasonId: seasonA },
      { id: epA1.id, order: 2 },
      { id: epA2.id, order: 3 },
    ]);

    const rows = await db.select().from(episodes);
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(byId.get(epB1.id)?.seasonId).toBe(seasonA);
    expect(byId.get(epB1.id)?.order).toBe(1);
    expect(byId.get(epA1.id)?.seasonId).toBe(seasonA);
    expect(byId.get(epA1.id)?.order).toBe(2);
    expect(byId.get(epA2.id)?.order).toBe(3);
  });
});