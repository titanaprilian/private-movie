import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";

async function insertTestSeries(overrides?: Partial<{
  id: string;
  title: string;
  description: string | null;
  posterUrl: string | null;
}>): Promise<{
  id: string;
  title: string;
  description: string | null;
  posterUrl: string | null;
}> {
  const id = overrides?.id ?? crypto.randomUUID();
  const title = overrides?.title ?? "Original Series Title";
  const description = overrides?.description ?? "Original Description";
  const posterUrl = overrides?.posterUrl ?? "https://example.com/original-poster.jpg";
  const now = new Date();

  await db.insert(series).values({
    id,
    title,
    description,
    posterUrl,
    createdAt: now,
    updatedAt: now,
  });

  return { id, title, description, posterUrl };
}

describe("PATCH /series/:id", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const seriesRow = await insertTestSeries();

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${seriesRow.id}`,
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
      const seriesRow = await insertTestSeries();

      const invalidTokenResponse = await request(app, {
        method: "PATCH",
        path: `/series/${seriesRow.id}`,
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
        path: `/series/${seriesRow.id}`,
        headers: authHeaders(expiredToken),
        body: {
          title: "New Title",
        },
      });

      expect(expiredTokenResponse.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 404 when series ID does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const nonexistentId = crypto.randomUUID();

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${nonexistentId}`,
        headers: authHeaders(accessToken),
        body: {
          title: "Updated Title",
        },
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("SERIES_NOT_FOUND");
    });
  });

  describe("partial update behavior", () => {
    it("successfully updates title only", async () => {
      const { accessToken } = await registerUser(app);
      const seriesRow = await insertTestSeries();

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${seriesRow.id}`,
        headers: authHeaders(accessToken),
        body: {
          title: "Updated Series Title Only",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          title: string;
          description: string | null;
          posterUrl: string | null;
        };
      };

      expect(body.data.id).toBe(seriesRow.id);
      expect(body.data.title).toBe("Updated Series Title Only");
      expect(body.data.description).toBe(seriesRow.description);
      expect(body.data.posterUrl).toBe(seriesRow.posterUrl);

      const rows = await db.select().from(series).where(eq(series.id, seriesRow.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("Updated Series Title Only");
      expect(rows[0].description).toBe(seriesRow.description);
    });

    it("successfully updates description only", async () => {
      const { accessToken } = await registerUser(app);
      const seriesRow = await insertTestSeries();
      const newDescription = "Brand new series description text";

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${seriesRow.id}`,
        headers: authHeaders(accessToken),
        body: {
          description: newDescription,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; title: string; description: string | null };
      };

      expect(body.data.title).toBe(seriesRow.title);
      expect(body.data.description).toBe(newDescription);

      const rows = await db.select().from(series).where(eq(series.id, seriesRow.id));
      expect(rows[0].description).toBe(newDescription);
      expect(rows[0].title).toBe(seriesRow.title);
    });

    it("successfully updates posterUrl only", async () => {
      const { accessToken } = await registerUser(app);
      const seriesRow = await insertTestSeries();
      const newPosterUrl = "https://example.com/new-poster-path.jpg";

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${seriesRow.id}`,
        headers: authHeaders(accessToken),
        body: {
          posterUrl: newPosterUrl,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; posterUrl: string | null };
      };

      expect(body.data.posterUrl).toBe(newPosterUrl);

      const rows = await db.select().from(series).where(eq(series.id, seriesRow.id));
      expect(rows[0].posterUrl).toBe(newPosterUrl);
    });

    it("successfully updates status only", async () => {
      const { accessToken } = await registerUser(app);
      const seriesRow = await insertTestSeries();

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${seriesRow.id}`,
        headers: authHeaders(accessToken),
        body: {
          status: "ongoing",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; status: string };
      };

      expect(body.data.status).toBe("ongoing");

      const rows = await db.select().from(series).where(eq(series.id, seriesRow.id));
      expect(rows[0].status).toBe("ongoing");
    });

    it("successfully updates isFeatured only", async () => {
      const { accessToken } = await registerUser(app);
      const seriesRow = await insertTestSeries();

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${seriesRow.id}`,
        headers: authHeaders(accessToken),
        body: {
          isFeatured: true,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; isFeatured: boolean };
      };

      expect(body.data.isFeatured).toBe(true);

      const rows = await db.select().from(series).where(eq(series.id, seriesRow.id));
      expect(rows[0].isFeatured).toBe(true);
    });

    it("successfully updates all allowed fields simultaneously (title, description, posterUrl, status, isFeatured)", async () => {
      const { accessToken } = await registerUser(app);
      const seriesRow = await insertTestSeries();

      const patchPayload = {
        title: "Fully Updated Series Title",
        description: "Fully updated series description",
        posterUrl: "https://example.com/fully-updated-poster.jpg",
        status: "ongoing",
        isFeatured: true,
      };

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${seriesRow.id}`,
        headers: authHeaders(accessToken),
        body: patchPayload,
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          title: string;
          description: string | null;
          posterUrl: string | null;
          status: string;
          isFeatured: boolean;
        };
      };

      expect(body.data.title).toBe(patchPayload.title);
      expect(body.data.description).toBe(patchPayload.description);
      expect(body.data.posterUrl).toBe(patchPayload.posterUrl);
      expect(body.data.status).toBe("ongoing");
      expect(body.data.isFeatured).toBe(true);

      const rows = await db.select().from(series).where(eq(series.id, seriesRow.id));
      expect(rows[0].title).toBe(patchPayload.title);
      expect(rows[0].description).toBe(patchPayload.description);
      expect(rows[0].posterUrl).toBe(patchPayload.posterUrl);
      expect(rows[0].status).toBe("ongoing");
      expect(rows[0].isFeatured).toBe(true);
    });
  });
});
