import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { createDbClient, seasons, series } from "@repo/db";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";

const db = createDbClient(process.env.DATABASE_URL!);

interface SeasonPayload {
  id: string;
  seriesId: string;
  title: string | null;
  description: string | null;
  seasonNumber: number | null;
  status: string | null;
  scraperUrl: string | null;
  source: string | null;
  episodeOffset: number | null;
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

describe("POST /series/:id/seasons", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    const user = await registerUser(app, {
      email: "create-season-tester@example.com",
      password: "password123",
      name: "Create Season Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  it("returns 401 when authorization header is missing", async () => {
    const seriesRow = await createSeries("Unauthorized Season Series");

    const result = await request(app, {
      method: "POST",
      path: `/series/${seriesRow.id}/seasons`,
      body: { title: "Season 2", seasonNumber: 2 },
    });

    expect(result.status).toBe(401);
  });

  it("returns 404 when the series does not exist", async () => {
    const result = await request(app, {
      method: "POST",
      path: `/series/${crypto.randomUUID()}/seasons`,
      headers,
      body: { title: "Season 1", seasonNumber: 1 },
    });

    expect(result.status).toBe(404);
    expect(errorCode(result.body)).toBe("SERIES_NOT_FOUND");
  });

  it("creates a season with defaults and persists it", async () => {
    const seriesRow = await createSeries("Create Season Happy Path");

    const result = await request(app, {
      method: "POST",
      path: `/series/${seriesRow.id}/seasons`,
      headers,
      body: { title: "Season 2", seasonNumber: 2, description: "Second cour" },
    });

    expect(result.status).toBe(200);
    const data = bodyData(result.body);
    expect(data.seriesId).toBe(seriesRow.id);
    expect(data.title).toBe("Season 2");
    expect(data.seasonNumber).toBe(2);
    expect(data.description).toBe("Second cour");
    expect(data.status).toBe("completed");
    expect(data.episodeOffset).toBe(0);

    const [dbRow] = await db.select().from(seasons).where(eq(seasons.id, data.id));
    expect(dbRow.seriesId).toBe(seriesRow.id);
    expect(dbRow.seasonNumber).toBe(2);
    expect(dbRow.status).toBe("completed");
  });

  it("creates an ongoing season with scraper configuration", async () => {
    const seriesRow = await createSeries("Create Ongoing Season Series");

    const result = await request(app, {
      method: "POST",
      path: `/series/${seriesRow.id}/seasons`,
      headers,
      body: {
        title: "Season 4",
        seasonNumber: 4,
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/ongoing-show",
        source: "otakudesu",
        episodeOffset: 66,
      },
    });

    expect(result.status).toBe(200);
    const data = bodyData(result.body);
    expect(data.status).toBe("ongoing");
    expect(data.scraperUrl).toBe("https://otakudesu.cloud/anime/ongoing-show");
    expect(data.source).toBe("otakudesu");
    expect(data.episodeOffset).toBe(66);
  });

  it("returns 409 when the season number already exists for the series", async () => {
    const seriesRow = await createSeries("Duplicate Season Number Series");
    await db.insert(seasons).values({
      id: crypto.randomUUID(),
      seriesId: seriesRow.id,
      title: "Season 1",
      seasonNumber: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await request(app, {
      method: "POST",
      path: `/series/${seriesRow.id}/seasons`,
      headers,
      body: { title: "Season 1 Clone", seasonNumber: 1 },
    });

    expect(result.status).toBe(409);
    expect(errorCode(result.body)).toBe("SEASON_ALREADY_EXISTS");

    const rows = await db
      .select()
      .from(seasons)
      .where(and(eq(seasons.seriesId, seriesRow.id), eq(seasons.seasonNumber, 1)));
    expect(rows).toHaveLength(1);
  });

  it("returns 400 for invalid payloads", async () => {
    const seriesRow = await createSeries("Invalid Season Payload Series");

    const missingTitle = await request(app, {
      method: "POST",
      path: `/series/${seriesRow.id}/seasons`,
      headers,
      body: { seasonNumber: 3 },
    });
    expect(missingTitle.status).toBe(400);
    expect(errorCode(missingTitle.body)).toBe("VALIDATION");

    const missingNumber = await request(app, {
      method: "POST",
      path: `/series/${seriesRow.id}/seasons`,
      headers,
      body: { title: "Season 3" },
    });
    expect(missingNumber.status).toBe(400);

    const badStatus = await request(app, {
      method: "POST",
      path: `/series/${seriesRow.id}/seasons`,
      headers,
      body: { title: "Season 3", seasonNumber: 3, status: "archived" },
    });
    expect(badStatus.status).toBe(400);
  });

  it("demotes the previous ongoing season when creating a new ongoing season", async () => {
    const seriesRow = await createSeries("Ongoing Demotion Series");
    const [oldOngoing] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId: seriesRow.id,
        title: "Season 3",
        seasonNumber: 3,
        status: "ongoing",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const result = await request(app, {
      method: "POST",
      path: `/series/${seriesRow.id}/seasons`,
      headers,
      body: { title: "Season 4", seasonNumber: 4, status: "ongoing" },
    });

    expect(result.status).toBe(200);
    expect(bodyData(result.body).status).toBe("ongoing");

    const [demoted] = await db.select().from(seasons).where(eq(seasons.id, oldOngoing.id));
    expect(demoted.status).toBe("completed");

    const ongoing = await db
      .select()
      .from(seasons)
      .where(and(eq(seasons.seriesId, seriesRow.id), eq(seasons.status, "ongoing")));
    expect(ongoing).toHaveLength(1);
    expect(ongoing[0].seasonNumber).toBe(4);
  });

  it("demotes the previous ongoing season when patching a season to ongoing", async () => {
    const seriesRow = await createSeries("Patch Demotion Series");
    const [first] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId: seriesRow.id,
        title: "Season 1",
        seasonNumber: 1,
        status: "ongoing",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    const [second] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId: seriesRow.id,
        title: "Season 2",
        seasonNumber: 2,
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const result = await request(app, {
      method: "PATCH",
      path: `/seasons/${second.id}`,
      headers,
      body: { status: "ongoing" },
    });

    expect(result.status).toBe(200);

    const [demoted] = await db.select().from(seasons).where(eq(seasons.id, first.id));
    expect(demoted.status).toBe("completed");

    const ongoing = await db
      .select()
      .from(seasons)
      .where(and(eq(seasons.seriesId, seriesRow.id), eq(seasons.status, "ongoing")));
    expect(ongoing).toHaveLength(1);
    expect(ongoing[0].id).toBe(second.id);
  });
});

describe("GET /seasons/:id", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    const user = await registerUser(app, {
      email: "get-season-tester@example.com",
      password: "password123",
      name: "Get Season Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  it("returns 404 when season does not exist", async () => {
    const result = await request(app, {
      method: "GET",
      path: `/seasons/${crypto.randomUUID()}`,
      headers,
    });

    expect(result.status).toBe(404);
    expect(errorCode(result.body)).toBe("SEASON_NOT_FOUND");
  });

  it("returns existing season", async () => {
    const seriesRow = await createSeries("Get Season Series");

    const [seasonRow] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId: seriesRow.id,
        title: "Season X",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const result = await request(app, {
      method: "GET",
      path: `/seasons/${seasonRow.id}`,
      headers,
    });

    expect(result.status).toBe(200);
    const data = bodyData(result.body);
    expect(data.id).toBe(seasonRow.id);
    expect(data.title).toBe("Season X");
  });
});
