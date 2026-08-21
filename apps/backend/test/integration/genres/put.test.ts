import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { genres } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";

async function insertGenreRow(options?: {
  name?: string;
  slug?: string;
}): Promise<{ id: string; name: string; slug: string }> {
  const id = crypto.randomUUID();
  const name = options?.name ?? `Genre ${id}`;
  const slug = options?.slug ?? `genre-${id}`;
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

describe("PUT /genres/:id", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const genre = await insertGenreRow();

      const response = await request(app, {
        method: "PUT",
        path: `/genres/${genre.id}`,
        body: {
          name: "Updated Name",
          slug: "updated-name",
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 404 when genre ID does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const nonexistentId = crypto.randomUUID();

      const response = await request(app, {
        method: "PUT",
        path: `/genres/${nonexistentId}`,
        headers: authHeaders(accessToken),
        body: {
          name: "Nonexistent Genre",
          slug: "nonexistent-genre",
        },
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("GENRE_NOT_FOUND");
    });
  });

  describe("validation", () => {
    it("returns 400 when updating genre with empty string name", async () => {
      const { accessToken } = await registerUser(app);
      const genre = await insertGenreRow();

      const response = await request(app, {
        method: "PUT",
        path: `/genres/${genre.id}`,
        headers: authHeaders(accessToken),
        body: {
          name: "",
          slug: "empty-name",
        },
      });

      expect(response.status).toBe(400);
    });
  });

  describe("conflict / duplicate handling", () => {
    it("returns 409 when attempting to rename a genre to a name or slug already taken by another genre", async () => {
      const { accessToken } = await registerUser(app);
      const genre1 = await insertGenreRow({ name: "Action", slug: "action" });
      const genre2 = await insertGenreRow({ name: "Comedy", slug: "comedy" });

      const duplicateResponse = await request(app, {
        method: "PUT",
        path: `/genres/${genre2.id}`,
        headers: authHeaders(accessToken),
        body: {
          name: genre1.name,
          slug: genre1.slug,
        },
      });

      expect(duplicateResponse.status).toBe(409);
      const body = duplicateResponse.body as { error: { code: string } };
      expect(body.error).toBeDefined();
      expect(["409", "GENRE_ALREADY_EXISTS", "CONFLICT", "DUPLICATE_GENRE"]).toContain(body.error.code);
    });
  });

  describe("happy path", () => {
    it("updates genre name and slug on happy path and persists to DB", async () => {
      const { accessToken } = await registerUser(app);
      const genre = await insertGenreRow({ name: "Comedy", slug: "comedy" });

      const updatedPayload = {
        name: "Romantic Comedy",
        slug: "romantic-comedy",
      };

      const response = await request(app, {
        method: "PUT",
        path: `/genres/${genre.id}`,
        headers: authHeaders(accessToken),
        body: updatedPayload,
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; name: string; slug: string };
      };

      expect(body.data.id).toBe(genre.id);
      expect(body.data.name).toBe(updatedPayload.name);
      expect(body.data.slug).toBe(updatedPayload.slug);

      const rows = await db
        .select()
        .from(genres)
        .where(eq(genres.id, genre.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe(updatedPayload.name);
      expect(rows[0].slug).toBe(updatedPayload.slug);
    });
  });
});
