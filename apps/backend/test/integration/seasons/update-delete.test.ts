import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { createDbClient, episodes, seasons, series } from "@repo/db";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";

const db = createDbClient(process.env.DATABASE_URL!);

interface SeasonPayload {
  id: string;
  seriesId: string;
  title: string | null;
  description: string | null;
}

function bodyData(body: unknown): SeasonPayload {
  return (body as { data: SeasonPayload }).data;
}

function errorCode(body: unknown): string {
  return (body as { error: { code: string } }).error.code;
}

async function createSeries(title: string) {
  const [row] = await db
    .insert(series)
    .values({
      id: crypto.randomUUID(),
      title,
      type: "tv",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

async function createSeason(seriesId: string, title: string) {
  const [row] = await db
    .insert(seasons)
    .values({
      id: crypto.randomUUID(),
      seriesId,
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

async function createEpisode(seasonId: string, order: number) {
  const [row] = await db
    .insert(episodes)
    .values({
      id: crypto.randomUUID(),
      title: `Episode ${order}`,
      order,
      seasonId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

describe("PATCH /seasons/:id", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    const user = await registerUser(app, {
      email: "patch-season-tester@example.com",
      password: "password123",
      name: "Patch Season Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  it("returns 401 when authorization header is missing", async () => {
    const result = await request(app, {
      method: "PATCH",
      path: `/seasons/${crypto.randomUUID()}`,
      body: { title: "Renamed" },
    });

    expect(result.status).toBe(401);
  });

  it("returns 404 when season does not exist", async () => {
    const result = await request(app, {
      method: "PATCH",
      path: `/seasons/${crypto.randomUUID()}`,
      headers,
      body: { title: "Renamed" },
    });

    expect(result.status).toBe(404);
    expect(errorCode(result.body)).toBe("SEASON_NOT_FOUND");
  });

  it("updates title, description, and status and persists them", async () => {
    const seriesRow = await createSeries("Patch Season Series");
    const seasonRow = await createSeason(seriesRow.id, "Old Title");

    const result = await request(app, {
      method: "PATCH",
      path: `/seasons/${seasonRow.id}`,
      headers,
      body: { title: "New Title", description: "Updated description", status: "ongoing" },
    });

    expect(result.status).toBe(200);
    const data = (result.body as { data: SeasonPayload & { status: string } }).data;
    expect(data.id).toBe(seasonRow.id);
    expect(data.title).toBe("New Title");
    expect(data.description).toBe("Updated description");
    expect(data.status).toBe("ongoing");

    const [dbRow] = await db.select().from(seasons).where(eq(seasons.id, seasonRow.id));
    expect(dbRow.title).toBe("New Title");
    expect(dbRow.description).toBe("Updated description");
    expect(dbRow.status).toBe("ongoing");
    expect(dbRow.updatedAt.getTime()).toBeGreaterThanOrEqual(dbRow.createdAt.getTime());
  });

  it("allows clearing the description with null", async () => {
    const seriesRow = await createSeries("Patch Null Season");
    const seasonRow = await createSeason(seriesRow.id, "Has Description");
    await db
      .update(seasons)
      .set({ description: "Something" })
      .where(eq(seasons.id, seasonRow.id));

    const result = await request(app, {
      method: "PATCH",
      path: `/seasons/${seasonRow.id}`,
      headers,
      body: { description: null },
    });

    expect(result.status).toBe(200);
    expect(bodyData(result.body).description).toBeNull();

    const [dbRow] = await db.select().from(seasons).where(eq(seasons.id, seasonRow.id));
    expect(dbRow.description).toBeNull();
  });

  it("rejects an empty title", async () => {
    const seriesRow = await createSeries("Patch Invalid Season");
    const seasonRow = await createSeason(seriesRow.id, "Valid");

    const result = await request(app, {
      method: "PATCH",
      path: `/seasons/${seasonRow.id}`,
      headers,
      body: { title: "" },
    });

    expect(result.status).toBe(400);
    expect(errorCode(result.body)).toBe("VALIDATION");
  });
});

describe("DELETE /seasons/:id", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    const user = await registerUser(app, {
      email: "delete-season-tester@example.com",
      password: "password123",
      name: "Delete Season Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  it("returns 401 when authorization header is missing", async () => {
    const result = await request(app, {
      method: "DELETE",
      path: `/seasons/${crypto.randomUUID()}`,
    });

    expect(result.status).toBe(401);
  });

  it("returns 404 when season does not exist", async () => {
    const result = await request(app, {
      method: "DELETE",
      path: `/seasons/${crypto.randomUUID()}`,
      headers,
    });

    expect(result.status).toBe(404);
    expect(errorCode(result.body)).toBe("SEASON_NOT_FOUND");
  });

  it("returns 409 when the season still contains episodes and keeps the row", async () => {
    const seriesRow = await createSeries("Delete Blocked Season");
    const seasonRow = await createSeason(seriesRow.id, "Not Empty");
    await createEpisode(seasonRow.id, 1);
    await createEpisode(seasonRow.id, 2);

    const result = await request(app, {
      method: "DELETE",
      path: `/seasons/${seasonRow.id}`,
      headers,
    });

    expect(result.status).toBe(409);
    expect(errorCode(result.body)).toBe("SEASON_NOT_EMPTY");

    const [dbRow] = await db.select().from(seasons).where(eq(seasons.id, seasonRow.id));
    expect(dbRow).toBeDefined();
  });

  it("deletes an empty season", async () => {
    const seriesRow = await createSeries("Delete Empty Season");
    const seasonRow = await createSeason(seriesRow.id, "Empty Season");

    const result = await request(app, {
      method: "DELETE",
      path: `/seasons/${seasonRow.id}`,
      headers,
    });

    expect(result.status).toBe(200);

    const [dbRow] = await db.select().from(seasons).where(eq(seasons.id, seasonRow.id));
    expect(dbRow).toBeUndefined();
  });
});
