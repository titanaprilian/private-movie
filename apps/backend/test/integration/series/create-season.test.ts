import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { createDbClient, seasons, series } from "@repo/db";
import crypto from "node:crypto";

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

describe("POST /series/:id/seasons (Decommissioned)", () => {
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

  it("returns 404 Not Found when invoked", async () => {
    const seriesRow = await createSeries("Manual Season Series");

    const result = await request(app, {
      method: "POST",
      path: `/series/${seriesRow.id}/seasons`,
      headers,
      body: { title: "Season 2 (Specials)", description: "Created by hand" },
    });

    expect(result.status).toBe(404);
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
