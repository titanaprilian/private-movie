import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  episodes as episodesTable,
  seasons,
  series,
  videoSources as videoSourcesTable,
} from "@repo/db";
import type { S3StorageService } from "@repo/media-service";
import { buildApp, request } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
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
  const id = crypto.randomUUID();
  const seasonId = await ensureSeason(crypto.randomUUID());
  const now = new Date();
  await db.insert(episodesTable).values({
    id,
    seasonId,
    title: "S3 Cleanup Episode",
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

async function insertTestVideoSource(
  episodeId: string,
  overrides?: Partial<{
    id: string;
    type: string;
    url: string;
    label: string;
    quality: string | null;
  }>
) {
  const id = overrides?.id ?? crypto.randomUUID();
  const type = overrides?.type ?? "embed";
  const url = overrides?.url ?? `https://embed.example.com/${crypto.randomUUID()}`;
  const label = overrides?.label ?? "Server 1";
  const quality = overrides?.quality ?? "720p";
  const now = new Date();

  await db.insert(videoSourcesTable).values({
    id,
    episodeId,
    type,
    url,
    label,
    quality,
    createdAt: now,
    updatedAt: now,
  });

  return { id, type, url, label, quality };
}

function createMockS3(overrides?: Partial<S3StorageService>): S3StorageService & {
  deleteObject: ReturnType<typeof vi.fn>;
  deleteObjects: ReturnType<typeof vi.fn>;
} {
  return {
    isConfigured: () => true,
    getPresignedUploadUrl: async (key: string) => ({
      uploadUrl: `https://s3.example.com/${key}`,
      key,
    }),
    getPresignedPlaybackUrl: async (key: string) =>
      `https://s3.signed.com/${key}?expires=21600`,
    deleteObject: vi.fn(async () => {}),
    deleteObjects: vi.fn(async () => {}),
    ...overrides,
  } as S3StorageService & {
    deleteObject: ReturnType<typeof vi.fn>;
    deleteObjects: ReturnType<typeof vi.fn>;
  };
}

describe("S3 object cleanup on deletion", () => {
  describe("DELETE /episodes/:id/sources/:sourceId", () => {
    it("calls S3 deleteObject with the S3 key when deleting an s3 source", async () => {
      const mockS3 = createMockS3();
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const s3Key = `episodes/${episode.id}/video-1080p.mp4`;
      const source = await insertTestVideoSource(episode.id, {
        type: "s3",
        url: s3Key,
        label: "B2 S3",
      });

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${episode.id}/sources/${source.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);
      expect(mockS3.deleteObject).toHaveBeenCalledTimes(1);
      expect(mockS3.deleteObject).toHaveBeenCalledWith(s3Key);

      const remaining = await db
        .select()
        .from(videoSourcesTable)
        .where(eq(videoSourcesTable.id, source.id));
      expect(remaining).toHaveLength(0);
    });

    it("does not invoke S3 deleteObject when deleting a non-S3 source", async () => {
      const mockS3 = createMockS3();
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const source = await insertTestVideoSource(episode.id, {
        type: "embed",
        url: "https://embed.example.com/video",
        label: "Embed",
      });

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${episode.id}/sources/${source.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);
      expect(mockS3.deleteObject).not.toHaveBeenCalled();
      expect(mockS3.deleteObjects).not.toHaveBeenCalled();
    });

    it("still deletes the source from the database when S3 deletion fails", async () => {
      const mockS3 = createMockS3({
        deleteObject: vi.fn(async () => {
          throw new Error("S3 remote failure");
        }),
      });
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const s3Key = `episodes/${episode.id}/video.mp4`;
      const source = await insertTestVideoSource(episode.id, {
        type: "s3",
        url: s3Key,
        label: "B2 S3",
      });

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${episode.id}/sources/${source.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);
      expect(mockS3.deleteObject).toHaveBeenCalledWith(s3Key);

      const remaining = await db
        .select()
        .from(videoSourcesTable)
        .where(eq(videoSourcesTable.id, source.id));
      expect(remaining).toHaveLength(0);
    });
  });

  describe("DELETE /episodes/:id", () => {
    it("deletes all S3 files for the episode via S3 deleteObjects", async () => {
      const mockS3 = createMockS3();
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const key1 = `episodes/${episode.id}/a.mp4`;
      const key2 = `episodes/${episode.id}/b.mp4`;
      await insertTestVideoSource(episode.id, {
        type: "s3",
        url: key1,
        label: "S3 A",
      });
      await insertTestVideoSource(episode.id, {
        type: "s3",
        url: key2,
        label: "S3 B",
      });
      await insertTestVideoSource(episode.id, {
        type: "direct",
        url: "https://example.com/direct.mp4",
        label: "Direct",
      });

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);
      expect(mockS3.deleteObjects).toHaveBeenCalledTimes(1);
      const calledKeys = mockS3.deleteObjects.mock.calls[0][0] as string[];
      expect(calledKeys.sort()).toEqual([key1, key2].sort());

      const remaining = await db
        .select()
        .from(episodesTable)
        .where(eq(episodesTable.id, episode.id));
      expect(remaining).toHaveLength(0);
    });

    it("still deletes the episode when S3 deletion fails", async () => {
      const mockS3 = createMockS3({
        deleteObjects: vi.fn(async () => {
          throw new Error("S3 batch failure");
        }),
      });
      const app = await buildApp({ s3StorageService: mockS3 });
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const key = `episodes/${episode.id}/video.mp4`;
      await insertTestVideoSource(episode.id, {
        type: "s3",
        url: key,
        label: "S3",
      });

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);
      expect(mockS3.deleteObjects).toHaveBeenCalledWith([key]);

      const remaining = await db
        .select()
        .from(episodesTable)
        .where(eq(episodesTable.id, episode.id));
      expect(remaining).toHaveLength(0);
    });
  });
});
