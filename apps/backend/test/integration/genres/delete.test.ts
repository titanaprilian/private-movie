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

describe("DELETE /genres/:id", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const genre = await insertGenreRow();

      const response = await request(app, {
        method: "DELETE",
        path: `/genres/${genre.id}`,
      });

      expect(response.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 404 when genre ID does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const nonexistentId = crypto.randomUUID();

      const response = await request(app, {
        method: "DELETE",
        path: `/genres/${nonexistentId}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("GENRE_NOT_FOUND");
    });
  });

  describe("happy path", () => {
    it("deletes genre record on happy path and removes from DB", async () => {
      const { accessToken } = await registerUser(app);
      const genre = await insertGenreRow({ name: "Horror", slug: "horror" });

      const response = await request(app, {
        method: "DELETE",
        path: `/genres/${genre.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);

      const rows = await db
        .select()
        .from(genres)
        .where(eq(genres.id, genre.id));
      expect(rows).toHaveLength(0);
    });
  });
});
