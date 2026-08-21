import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { genres } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
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

describe("POST /genres", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const response = await request(app, {
        method: "POST",
        path: "/genres",
        body: {
          name: "Sci-Fi",
          slug: "sci-fi",
        },
      });

      expect(response.status).toBe(401);
      const body = response.body as { error: { code: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when authorization token is invalid or expired", async () => {
      const expiredToken = signTestToken(
        { sub: "some-user-id" },
        { expiresInSeconds: -3600 }
      );

      const response = await request(app, {
        method: "POST",
        path: "/genres",
        headers: authHeaders(expiredToken),
        body: {
          name: "Sci-Fi",
          slug: "sci-fi",
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("happy path", () => {
    it("creates a new genre on happy path and persists to DB", async () => {
      const { accessToken } = await registerUser(app);

      const payload = {
        name: "Sci-Fi & Fantasy",
        slug: "sci-fi-and-fantasy",
      };

      const response = await request(app, {
        method: "POST",
        path: "/genres",
        headers: authHeaders(accessToken),
        body: payload,
      });

      expect([200, 201]).toContain(response.status);
      const body = response.body as {
        data: { id: string; name: string; slug: string };
      };

      expect(body.data).toBeDefined();
      expect(body.data.name).toBe(payload.name);
      expect(body.data.slug).toBe(payload.slug);
      expect(body.data.id).toBeDefined();

      const rows = await db
        .select()
        .from(genres)
        .where(eq(genres.id, body.data.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe(payload.name);
      expect(rows[0].slug).toBe(payload.slug);
    });
  });

  describe("validation", () => {
    it("returns 400 on empty object payload", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/genres",
        headers: authHeaders(accessToken),
        body: {},
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 when genre name is empty string", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/genres",
        headers: authHeaders(accessToken),
        body: {
          name: "",
          slug: "empty-name",
        },
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 when genre name is null or invalid type", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/genres",
        headers: authHeaders(accessToken),
        body: {
          name: null,
        },
      });

      expect(response.status).toBe(400);
    });
  });

  describe("conflict / duplicate handling", () => {
    it("returns 409 when attempting to create a genre with an existing name or slug", async () => {
      const { accessToken } = await registerUser(app);
      await insertGenreRow({ name: "Action", slug: "action" });

      const duplicateResponse = await request(app, {
        method: "POST",
        path: "/genres",
        headers: authHeaders(accessToken),
        body: {
          name: "Action",
          slug: "action",
        },
      });

      expect(duplicateResponse.status).toBe(409);
      const body = duplicateResponse.body as { error: { code: string } };
      expect(body.error).toBeDefined();
      expect(["409", "GENRE_ALREADY_EXISTS", "CONFLICT", "DUPLICATE_GENRE"]).toContain(body.error.code);
    });
  });
});
