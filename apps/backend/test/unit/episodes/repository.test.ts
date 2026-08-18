import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { episodes } from "@repo/db";
import { createEpisodeRepositoryInternal } from "@repo/media-service";
import { db } from "../../utils/db";

function makeVideoUrl(index: number): string {
  return `https://otakudesu.blog/episode/unit-repo-${index}/`;
}

async function insertEpisode(sourceUrl: string): Promise<{ id: string }> {
  const now = new Date();
  const rows = await db
    .insert(episodes)
    .values({
      id: crypto.randomUUID(),
      sourceUrl,
      source: "otakudesu",
      title: "original-title",
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
  });

  it("inserts new episode and updates on conflict", async () => {
    const row = await repository.upsert({
      sourceUrl: makeVideoUrl(50),
      source: "otakudesu",
      title: "Episode 50",
      videoType: "TV",
      metadata: { duration: "24 min" },
    });

    expect(row.title).toBe("Episode 50");
    expect(row.videoType).toBe("TV");

    // Conflict update
    const updated = await repository.upsert({
      sourceUrl: makeVideoUrl(50),
      source: "otakudesu",
      title: "Episode 50 Updated",
      videoType: "TV",
      metadata: { duration: "25 min" },
    });

    expect(updated.id).toBe(row.id);
    expect(updated.title).toBe("Episode 50 Updated");
  });
});

describe("episode repository deleteEpisode", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
  });

  it("hard-deletes an existing episode and returns the deleted row", async () => {
    const existing = await insertEpisode(makeVideoUrl(1));

    const deleted = await repository.deleteEpisode(existing.id);

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(existing.id);
    expect(deleted.sourceUrl).toBe(makeVideoUrl(1));

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

  it("partially updates episode title, videoType, metadata and returns updated row", async () => {
    const existing = await insertEpisode(makeVideoUrl(10));

    // Update title only
    const updatedTitle = await repository.updateEpisode(existing.id, {
      title: "Updated Title",
    });
    expect(updatedTitle.title).toBe("Updated Title");

    // Update videoType only
    const updatedType = await repository.updateEpisode(existing.id, {
      videoType: "Movie",
    });
    expect(updatedType.videoType).toBe("Movie");

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

    // Update metadata only
    const updatedMeta = await repository.updateEpisode(existing.id, {
      metadata: { customField: "customValue" },
    });
    expect(updatedMeta.metadata).toEqual({ customField: "customValue" });

    // Update all allowed fields
    const updatedAll = await repository.updateEpisode(existing.id, {
      title: "Final Title",
      videoType: "OVA",
      description: "Final Description",
      metadata: { episodes: [1, 2, 3] },
    });
    expect(updatedAll.title).toBe("Final Title");
    expect(updatedAll.videoType).toBe("OVA");
    expect(updatedAll.description).toBe("Final Description");
    expect(updatedAll.metadata).toEqual({ episodes: [1, 2, 3] });
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
    const ep1 = await insertEpisode(makeVideoUrl(101));
    const ep2 = await insertEpisode(makeVideoUrl(102));

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
    const ep1 = await insertEpisode(makeVideoUrl(201));
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
});