import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, videoSources, seasons, series } from "@repo/db";
import {
  createVideoSourceRepositoryInternal,
  VideoSourceNotFoundError,
} from "@repo/media-service";
import { db } from "../../utils/db";

async function ensureSeason(id: string): Promise<string> {
  const [existing] = await db.select().from(seasons).where(eq(seasons.id, id));
  if (existing) return existing.id;

  const now = new Date();
  const [sRow] = await db
    .insert(series)
    .values({
      id: crypto.randomUUID(),
      title: "Test Series",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [seasonRow] = await db
    .insert(seasons)
    .values({
      id,
      seriesId: sRow.id,
      title: "Test Season",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return seasonRow.id;
}

async function insertTestEpisode(): Promise<{ id: string }> {
  const now = new Date();
  const seasonId = await ensureSeason(crypto.randomUUID());
  const rows = await db
    .insert(episodes)
    .values({
      id: crypto.randomUUID(),
      seasonId,
      title: "Test Episode",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0];
}

describe("videoSources repository", () => {
  const repository = createVideoSourceRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(videoSources);
    await db.delete(episodes);
  });

  describe("upsert", () => {
    it("inserts a new video source and returns the created row", async () => {
      const ep = await insertTestEpisode();
      const created = await repository.upsert({
        episodeId: ep.id,
        type: "embed",
        url: "https://example.com/embed/1",
        label: "Server 1",
        quality: "720p",
      });

      expect(created.id).toBeDefined();
      expect(created.episodeId).toBe(ep.id);
      expect(created.type).toBe("embed");
      expect(created.url).toBe("https://example.com/embed/1");
      expect(created.label).toBe("Server 1");
      expect(created.quality).toBe("720p");
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("updates existing source on conflict on (episode_id, url)", async () => {
      const ep = await insertTestEpisode();
      const initial = await repository.upsert({
        episodeId: ep.id,
        type: "embed",
        url: "https://example.com/embed/1",
        label: "Server 1",
        quality: "720p",
      });

      const updated = await repository.upsert({
        episodeId: ep.id,
        type: "direct",
        url: "https://example.com/embed/1",
        label: "Server 1 Direct",
        quality: "1080p",
      });

      expect(updated.id).toBe(initial.id);
      expect(updated.type).toBe("direct");
      expect(updated.label).toBe("Server 1 Direct");
      expect(updated.quality).toBe("1080p");
    });
  });

  describe("findById", () => {
    it("returns video source row by id", async () => {
      const ep = await insertTestEpisode();
      const created = await repository.upsert({
        episodeId: ep.id,
        type: "direct",
        url: "https://example.com/video.mp4",
        label: "Direct Stream",
      });

      const found = await repository.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.url).toBe("https://example.com/video.mp4");
    });

    it("returns null when id does not exist", async () => {
      const found = await repository.findById(crypto.randomUUID());
      expect(found).toBeNull();
    });
  });

  describe("findByEpisodeId", () => {
    it("returns all video sources for given episode ordered by createdAt asc", async () => {
      const ep1 = await insertTestEpisode();
      const ep2 = await insertTestEpisode();

      const src1 = await repository.upsert({
        episodeId: ep1.id,
        type: "embed",
        url: "https://example.com/embed/1",
        label: "Server 1",
      });

      const src2 = await repository.upsert({
        episodeId: ep1.id,
        type: "direct",
        url: "https://example.com/direct/1",
        label: "Direct 1",
      });

      await repository.upsert({
        episodeId: ep2.id,
        type: "embed",
        url: "https://example.com/embed/2",
        label: "Server 2",
      });

      const sources1 = await repository.findByEpisodeId(ep1.id);
      expect(sources1).toHaveLength(2);
      expect(sources1[0].id).toBe(src1.id);
      expect(sources1[1].id).toBe(src2.id);

      const sources2 = await repository.findByEpisodeId(ep2.id);
      expect(sources2).toHaveLength(1);
    });

    it("returns empty array when episode has no video sources", async () => {
      const ep = await insertTestEpisode();
      const sources = await repository.findByEpisodeId(ep.id);
      expect(sources).toEqual([]);
    });
  });

  describe("update", () => {
    it("partially updates video source fields", async () => {
      const ep = await insertTestEpisode();
      const created = await repository.upsert({
        episodeId: ep.id,
        type: "embed",
        url: "https://example.com/embed/1",
        label: "Server 1",
        quality: "720p",
      });

      const updated = await repository.update(created.id, {
        label: "Server 1 (HD)",
        quality: "1080p",
      });

      expect(updated.id).toBe(created.id);
      expect(updated.label).toBe("Server 1 (HD)");
      expect(updated.quality).toBe("1080p");
      expect(updated.type).toBe("embed");
    });

    it("throws VideoSourceNotFoundError when updating non-existent id", async () => {
      const missingId = crypto.randomUUID();
      await expect(
        repository.update(missingId, { label: "New Label" })
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof Error && err.name === "VideoSourceNotFoundError"
      );
    });
  });

  describe("delete", () => {
    it("deletes a video source and returns deleted row", async () => {
      const ep = await insertTestEpisode();
      const created = await repository.upsert({
        episodeId: ep.id,
        type: "embed",
        url: "https://example.com/embed/1",
        label: "Server 1",
      });

      const deleted = await repository.delete(created.id);
      expect(deleted.id).toBe(created.id);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it("throws VideoSourceNotFoundError when deleting non-existent id", async () => {
      const missingId = crypto.randomUUID();
      await expect(repository.delete(missingId)).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof Error && err.name === "VideoSourceNotFoundError"
      );
    });
  });

  describe("deleteByEpisodeId", () => {
    it("deletes all video sources associated with an episode", async () => {
      const ep = await insertTestEpisode();
      await repository.upsert({
        episodeId: ep.id,
        type: "embed",
        url: "https://example.com/embed/1",
        label: "Server 1",
      });
      await repository.upsert({
        episodeId: ep.id,
        type: "direct",
        url: "https://example.com/direct/1",
        label: "Direct 1",
      });

      const deletedRows = await repository.deleteByEpisodeId(ep.id);
      expect(deletedRows).toHaveLength(2);

      const remaining = await repository.findByEpisodeId(ep.id);
      expect(remaining).toHaveLength(0);
    });
  });

  describe("cascade delete behavior", () => {
    it("automatically deletes video sources when episode is deleted from episodes table", async () => {
      const ep = await insertTestEpisode();
      const src = await repository.upsert({
        episodeId: ep.id,
        type: "embed",
        url: "https://example.com/embed/1",
        label: "Server 1",
      });

      // Delete the episode from episodes table directly
      await db.delete(episodes).where(eq(episodes.id, ep.id));

      const foundSrc = await repository.findById(src.id);
      expect(foundSrc).toBeNull();

      const epSources = await repository.findByEpisodeId(ep.id);
      expect(epSources).toHaveLength(0);
    });
  });
});
