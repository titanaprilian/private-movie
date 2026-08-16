import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { episodes } from "@repo/db";
import { createEpisodeRepositoryInternal } from "@/modules/media/internal/episodes/repository";
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
      embedUrl: "https://odvidhide.com/embed/test",
      videoUrl: "https://example.com/stream.mp4",
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

  it("inserts new episode storing both embedUrl and videoUrl fields", async () => {
    const row = await repository.upsert({
      sourceUrl: makeVideoUrl(50),
      source: "otakudesu",
      title: "Episode 50",
      videoType: "TV",
      embedUrl: "https://odvidhide.com/embed/ep50",
      videoUrl: "https://cdn.example.com/ep50.mp4",
      metadata: { duration: "24 min" },
    });

    expect(row.embedUrl).toBe("https://odvidhide.com/embed/ep50");
    expect(row.videoUrl).toBe("https://cdn.example.com/ep50.mp4");

    // Conflict update
    const updated = await repository.upsert({
      sourceUrl: makeVideoUrl(50),
      source: "otakudesu",
      title: "Episode 50 Updated",
      videoType: "TV",
      embedUrl: "https://odvidhide.com/embed/ep50-v2",
      videoUrl: "https://cdn.example.com/ep50-v2.mp4",
      metadata: { duration: "25 min" },
    });

    expect(updated.id).toBe(row.id);
    expect(updated.embedUrl).toBe("https://odvidhide.com/embed/ep50-v2");
    expect(updated.videoUrl).toBe("https://cdn.example.com/ep50-v2.mp4");
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

  it("partially updates episode title, embedUrl, videoUrl, videoType, metadata and returns updated row", async () => {
    const existing = await insertEpisode(makeVideoUrl(10));

    // Update title only
    const updatedTitle = await repository.updateEpisode(existing.id, {
      title: "Updated Title",
    });
    expect(updatedTitle.title).toBe("Updated Title");
    expect(updatedTitle.embedUrl).toBe("https://odvidhide.com/embed/test");
    expect(updatedTitle.videoUrl).toBe("https://example.com/stream.mp4");

    // Update embedUrl only
    const updatedEmbed = await repository.updateEpisode(existing.id, {
      embedUrl: "https://example.com/embed-new",
    });
    expect(updatedEmbed.embedUrl).toBe("https://example.com/embed-new");

    // Update videoUrl only
    const updatedUrl = await repository.updateEpisode(existing.id, {
      videoUrl: "https://example.com/stream-new.mp4",
    });
    expect(updatedUrl.title).toBe("Updated Title");
    expect(updatedUrl.videoUrl).toBe("https://example.com/stream-new.mp4");

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

    // Update all 5 allowed fields
    const updatedAll = await repository.updateEpisode(existing.id, {
      title: "Final Title",
      videoUrl: "https://example.com/final-embed",
      videoType: "OVA",
      description: "Final Description",
      metadata: { episodes: [1, 2, 3] },
    });
    expect(updatedAll.title).toBe("Final Title");
    expect(updatedAll.videoUrl).toBe("https://example.com/final-embed");
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