import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { genres, series, seriesToGenres } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";

async function insertSeriesRow(title?: string): Promise<{ id: string; title: string }> {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(series).values({
    id,
    sourceUrl: `https://otakudesu.blog/anime/series-${id}/`,
    source: "otakudesu",
    title: title ?? `Series ${id}`,
    description: "Original Description",
    posterUrl: "https://example.com/poster.jpg",
    createdAt: now,
    updatedAt: now,
  });

  return { id, title: title ?? `Series ${id}` };
}

async function insertGenreRow(name: string, slug: string): Promise<{ id: string; name: string; slug: string }> {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(genres).values({
    id,
    name,
    slug,
    createdAt: now,
    updatedAt: now,
  });

  return { id, name, slug };
}

describe("PUT /series/:id", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const s = await insertSeriesRow();

      const response = await request(app, {
        method: "PUT",
        path: `/series/${s.id}`,
        body: {
          title: "Updated Title",
        },
      });

      expect(response.status).toBe(401);
      const body = response.body as { error: { code: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when authorization token is invalid or expired", async () => {
      const s = await insertSeriesRow();
      const expiredToken = signTestToken(
        { sub: "some-user-id" },
        { expiresInSeconds: -3600 }
      );

      const response = await request(app, {
        method: "PUT",
        path: `/series/${s.id}`,
        headers: authHeaders(expiredToken),
        body: {
          title: "Updated Title",
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 404 when series ID does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const nonexistentId = crypto.randomUUID();

      const response = await request(app, {
        method: "PUT",
        path: `/series/${nonexistentId}`,
        headers: authHeaders(accessToken),
        body: {
          title: "Nonexistent Series",
        },
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("SERIES_NOT_FOUND");
    });
  });

  describe("relationship updates in seriesToGenres", () => {
    it("correctly applies relationship updates in seriesToGenres when passing genreIds", async () => {
      const { accessToken } = await registerUser(app);
      const s = await insertSeriesRow("My Series");

      const genre1 = await insertGenreRow("Action", "action");
      const genre2 = await insertGenreRow("Adventure", "adventure");
      const genre3 = await insertGenreRow("Sci-Fi", "sci-fi");

      // 1. Initial PUT with genreIds: [genre1.id, genre2.id]
      const putResponse1 = await request(app, {
        method: "PUT",
        path: `/series/${s.id}`,
        headers: authHeaders(accessToken),
        body: {
          title: "My Series Updated",
          description: "Updated Description",
          posterUrl: "https://example.com/new-poster.jpg",
          genreIds: [genre1.id, genre2.id],
        },
      });

      expect(putResponse1.status).toBe(200);

      // Verify DB seriesToGenres mapping table has genre1 and genre2
      const mappings1 = await db
        .select()
        .from(seriesToGenres)
        .where(eq(seriesToGenres.seriesId, s.id));

      expect(mappings1).toHaveLength(2);
      const genreIds1 = mappings1.map((m) => m.genreId);
      expect(genreIds1).toContain(genre1.id);
      expect(genreIds1).toContain(genre2.id);

      // 2. Replace relationship with genreIds: [genre3.id]
      const putResponse2 = await request(app, {
        method: "PUT",
        path: `/series/${s.id}`,
        headers: authHeaders(accessToken),
        body: {
          title: "My Series Updated Again",
          genreIds: [genre3.id],
        },
      });

      expect(putResponse2.status).toBe(200);

      // Verify DB seriesToGenres mapping table now only has genre3
      const mappings2 = await db
        .select()
        .from(seriesToGenres)
        .where(eq(seriesToGenres.seriesId, s.id));

      expect(mappings2).toHaveLength(1);
      expect(mappings2[0].genreId).toBe(genre3.id);

      // 3. Clear relationships with empty genreIds array: []
      const putResponse3 = await request(app, {
        method: "PUT",
        path: `/series/${s.id}`,
        headers: authHeaders(accessToken),
        body: {
          genreIds: [],
        },
      });

      expect(putResponse3.status).toBe(200);

      const mappings3 = await db
        .select()
        .from(seriesToGenres)
        .where(eq(seriesToGenres.seriesId, s.id));

      expect(mappings3).toHaveLength(0);
    });
  });
});
