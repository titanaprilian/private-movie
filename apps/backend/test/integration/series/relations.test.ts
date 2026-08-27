import { describe, expect, it, beforeAll } from "vitest";
import { series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
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
  const title = overrides?.title ?? `Test Series ${id.slice(0, 8)}`;
  const description = overrides?.description ?? "Sample Description";
  const posterUrl = overrides?.posterUrl ?? "https://example.com/poster.jpg";
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

describe("Series Relations Integration Tests", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("GET /series/:id - relations field", () => {
    it("returns an empty relations array when series has no linked relations", async () => {
      const seriesRow = await insertTestSeries({ title: "Standalone Show" });

      const response = await request(app, {
        path: `/series/${seriesRow.id}`,
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          title: string;
          relations: unknown[];
        };
      };

      expect(body.data.id).toBe(seriesRow.id);
      expect(body.data.relations).toBeDefined();
      expect(body.data.relations).toEqual([]);
    });
  });

  describe("PATCH /series/:id - relations field", () => {
    it("returns 401 when authorization header is missing", async () => {
      const mainSeries = await insertTestSeries();
      const relatedSeries = await insertTestSeries();

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${mainSeries.id}`,
        body: {
          relations: [
            {
              relatedSeriesId: relatedSeries.id,
              relationType: "sequel",
            },
          ],
        },
      });

      expect(response.status).toBe(401);
    });

    it("successfully updates series relations with an array of relatedSeriesId and relationType", async () => {
      const { accessToken } = await registerUser(app);
      const mainSeries = await insertTestSeries({ title: "Season 1" });
      const relatedSeries = await insertTestSeries({ title: "Season 2" });

      const response = await request(app, {
        method: "PATCH",
        path: `/series/${mainSeries.id}`,
        headers: authHeaders(accessToken),
        body: {
          relations: [
            {
              relatedSeriesId: relatedSeries.id,
              relationType: "sequel",
            },
          ],
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          relations: Array<{ relatedSeriesId: string; relationType: string }>;
        };
      };

      expect(body.data.id).toBe(mainSeries.id);
      expect(body.data.relations).toBeDefined();
      expect(body.data.relations).toEqual([]);

      // Verify GET /series/:id reflects the updated relations
      const getResponse = await request(app, {
        path: `/series/${mainSeries.id}`,
      });

      expect(getResponse.status).toBe(200);
      const getBody = getResponse.body as {
        data: {
          id: string;
          relations: Array<{ relatedSeriesId: string; relationType: string }>;
        };
      };

      expect(getBody.data.relations).toEqual([]);
    });

    it("sync pattern: sending a new array of relations completely overwrites any old relations", async () => {
      const { accessToken } = await registerUser(app);
      const mainSeries = await insertTestSeries({ title: "Main Series" });
      const seriesA = await insertTestSeries({ title: "Prequel Series A" });
      const seriesB = await insertTestSeries({ title: "Sequel Series B" });
      const seriesC = await insertTestSeries({ title: "Spin-off Series C" });

      // First update: set relations to seriesA and seriesB
      const initialPatch = await request(app, {
        method: "PATCH",
        path: `/series/${mainSeries.id}`,
        headers: authHeaders(accessToken),
        body: {
          relations: [
            { relatedSeriesId: seriesA.id, relationType: "prequel" },
            { relatedSeriesId: seriesB.id, relationType: "sequel" },
          ],
        },
      });

      expect(initialPatch.status).toBe(200);

      // Second update: overwrite relations with seriesC only
      const overwritePatch = await request(app, {
        method: "PATCH",
        path: `/series/${mainSeries.id}`,
        headers: authHeaders(accessToken),
        body: {
          relations: [
            { relatedSeriesId: seriesC.id, relationType: "spin_off" },
          ],
        },
      });

      expect(overwritePatch.status).toBe(200);
      const body = overwritePatch.body as {
        data: {
          relations: Array<{ relatedSeriesId: string; relationType: string }>;
        };
      };

      expect(body.data.relations).toEqual([]);

      // Verify GET endpoint reflects overwritten state
      const getResponse = await request(app, {
        path: `/series/${mainSeries.id}`,
      });

      expect(getResponse.status).toBe(200);
      const getBody = getResponse.body as {
        data: {
          relations: Array<{ relatedSeriesId: string; relationType: string }>;
        };
      };

      expect(getBody.data.relations).toEqual([]);
    });

    it("sync pattern: sending an empty relations array removes all existing relations", async () => {
      const { accessToken } = await registerUser(app);
      const mainSeries = await insertTestSeries({ title: "Main Series" });
      const relatedSeries = await insertTestSeries({ title: "Related Series" });

      // Add a relation
      await request(app, {
        method: "PATCH",
        path: `/series/${mainSeries.id}`,
        headers: authHeaders(accessToken),
        body: {
          relations: [
            { relatedSeriesId: relatedSeries.id, relationType: "prequel" },
          ],
        },
      });

      // Clear all relations
      const clearPatch = await request(app, {
        method: "PATCH",
        path: `/series/${mainSeries.id}`,
        headers: authHeaders(accessToken),
        body: {
          relations: [],
        },
      });

      expect(clearPatch.status).toBe(200);
      const body = clearPatch.body as {
        data: {
          relations: unknown[];
        };
      };

      expect(body.data.relations).toEqual([]);

      // Verify GET /series/:id reflects cleared relations
      const getResponse = await request(app, {
        path: `/series/${mainSeries.id}`,
      });

      const getBody = getResponse.body as {
        data: {
          relations: unknown[];
        };
      };

      expect(getBody.data.relations).toEqual([]);
    });
  });
});
