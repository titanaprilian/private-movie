import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
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

async function insertTestEpisode(overrides?: Partial<{
  id: string;
  title: string;
}>): Promise<{
  id: string;
  title: string;
}> {
  const id = overrides?.id ?? crypto.randomUUID();
  const title = overrides?.title ?? "Original Title";
  const seasonId = await ensureSeason(crypto.randomUUID());
  const now = new Date();

  await db.insert(episodes).values({
    id,
    seasonId,
    title,
    createdAt: now,
    updatedAt: now,
  });

  return { id, title };
}

describe("PATCH /episodes/:id", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const episode = await insertTestEpisode();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        body: {
          title: "New Title",
        },
      });

      expect(response.status).toBe(401);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when authorization token is invalid or expired", async () => {
      const episode = await insertTestEpisode();

      const invalidTokenResponse = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders("invalid-token-string"),
        body: {
          title: "New Title",
        },
      });

      expect(invalidTokenResponse.status).toBe(401);

      const expiredToken = signTestToken(
        { sub: "some-user-id" },
        { expiresInSeconds: -3600 }
      );
      const expiredTokenResponse = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(expiredToken),
        body: {
          title: "New Title",
        },
      });

      expect(expiredTokenResponse.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 404 when episode ID does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const nonexistentId = crypto.randomUUID();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${nonexistentId}`,
        headers: authHeaders(accessToken),
        body: {
          title: "Updated Title",
        },
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");
    });
  });

  describe("partial update behavior", () => {
    it("successfully updates title only (1 field)", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
        body: {
          title: "Updated Title Only",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          title: string;
          videoType: string | null;
          metadata: Record<string, unknown>;
        };
      };

      expect(body.data.id).toBe(episode.id);
      expect(body.data.title).toBe("Updated Title Only");

      // Verify in DB
      const rows = await db.select().from(episodes).where(eq(episodes.id, episode.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("Updated Title Only");
    });

    it("successfully updates description only (1 field)", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
        body: {
          description: "New Episode Description",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; description: string | null };
      };

      expect(body.data.description).toBe("New Episode Description");

      const rows = await db.select().from(episodes).where(eq(episodes.id, episode.id));
      expect(rows[0].description).toBe("New Episode Description");
    });

    it("successfully updates all allowed fields simultaneously (title, description)", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();

      const patchPayload = {
        title: "All Fields Updated",
        description: "Updated description for all fields",
      };

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
        body: patchPayload,
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          title: string;
          description: string | null;
        };
      };

      expect(body.data.title).toBe(patchPayload.title);
      expect(body.data.description).toBe(patchPayload.description);

      const rows = await db.select().from(episodes).where(eq(episodes.id, episode.id));
      expect(rows[0].title).toBe(patchPayload.title);
      expect(rows[0].description).toBe(patchPayload.description);
    });
  });
});