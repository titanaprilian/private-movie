import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { videos } from "@repo/db";
import { createVideoRepositoryInternal } from "@/modules/videos/internal/repository";
import { db } from "../../utils/db";

function makeVideoUrl(index: number): string {
  return `https://otakudesu.blog/episode/unit-repo-${index}/`;
}

async function insertVideo(sourceUrl: string): Promise<{ id: string }> {
  const now = new Date();
  const rows = await db
    .insert(videos)
    .values({
      id: crypto.randomUUID(),
      sourceUrl,
      source: "otakudesu",
      title: "original-title",
      videoType: null,
      videoUrl: "https://odvidhide.com/embed/test",
      metadata: {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0];
}

describe("video repository deleteVideo", () => {
  const repository = createVideoRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(videos);
  });

  it("hard-deletes an existing video and returns the deleted row", async () => {
    const existing = await insertVideo(makeVideoUrl(1));

    const deleted = await repository.deleteVideo(existing.id);

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(existing.id);
    expect(deleted.sourceUrl).toBe(makeVideoUrl(1));

    const remaining = await db
      .select()
      .from(videos)
      .where(eq(videos.id, existing.id));
    expect(remaining).toHaveLength(0);
  });

  it("throws an explicit error when the video id does not exist", async () => {
    const missingId = crypto.randomUUID();

    const result = repository.deleteVideo(missingId);
    await expect(result).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Error && error.name === "VideoNotFoundError"
    );
  });
});

describe("video repository updateVideo", () => {
  const repository = createVideoRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(videos);
  });

  it("partially updates video title, videoUrl, videoType, metadata and returns updated row", async () => {
    const existing = await insertVideo(makeVideoUrl(10));

    // Update title only
    const updatedTitle = await repository.updateVideo(existing.id, {
      title: "Updated Title",
    });
    expect(updatedTitle.title).toBe("Updated Title");
    expect(updatedTitle.videoUrl).toBe("https://odvidhide.com/embed/test");

    // Update videoUrl only
    const updatedUrl = await repository.updateVideo(existing.id, {
      videoUrl: "https://example.com/embed-new",
    });
    expect(updatedUrl.title).toBe("Updated Title");
    expect(updatedUrl.videoUrl).toBe("https://example.com/embed-new");

    // Update videoType only
    const updatedType = await repository.updateVideo(existing.id, {
      videoType: "Movie",
    });
    expect(updatedType.videoType).toBe("Movie");

    // Update metadata only
    const updatedMeta = await repository.updateVideo(existing.id, {
      metadata: { customField: "customValue" },
    });
    expect(updatedMeta.metadata).toEqual({ customField: "customValue" });

    // Update all 4 allowed fields
    const updatedAll = await repository.updateVideo(existing.id, {
      title: "Final Title",
      videoUrl: "https://example.com/final-embed",
      videoType: "OVA",
      metadata: { episodes: [1, 2, 3] },
    });
    expect(updatedAll.title).toBe("Final Title");
    expect(updatedAll.videoUrl).toBe("https://example.com/final-embed");
    expect(updatedAll.videoType).toBe("OVA");
    expect(updatedAll.metadata).toEqual({ episodes: [1, 2, 3] });
  });

  it("throws VideoNotFoundError when updating a non-existent video id", async () => {
    const missingId = crypto.randomUUID();

    const result = repository.updateVideo(missingId, {
      title: "Should Fail",
    });
    await expect(result).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Error && error.name === "VideoNotFoundError"
    );
  });
});