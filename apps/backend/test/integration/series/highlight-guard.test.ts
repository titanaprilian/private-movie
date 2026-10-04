import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { seasons, series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";

async function insertSeries(title: string, highlighted: boolean): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(series).values({
    id,
    title,
    description: `${title} description`,
    posterUrl: "https://example.com/poster.jpg",
    isOngoingHighlighted: highlighted,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function insertSeason(seriesId: string, status: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(seasons).values({
    id,
    seriesId,
    title: `Season ${status}`,
    status,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

describe("highlight guard and auto-unmark (ticket 663)", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    const { accessToken } = await registerUser(app);
    headers = authHeaders(accessToken);
  });

  it("PUT rejects highlight=true with 400 when no ongoing seasons", async () => {
    const id = await insertSeries("Guard PUT no-ongoing", false);
    await insertSeason(id, "completed");
    const res = await request(app, {
      method: "PUT",
      path: `/series/${id}`,
      headers,
      body: { isOngoingHighlighted: true },
    });
    expect(res.status).toBe(400);
  });

  it("PATCH rejects highlight=true with 400 when no ongoing seasons", async () => {
    const id = await insertSeries("Guard PATCH no-ongoing", false);
    await insertSeason(id, "completed");
    const res = await request(app, {
      method: "PATCH",
      path: `/series/${id}`,
      headers,
      body: { isOngoingHighlighted: true },
    });
    expect(res.status).toBe(400);
  });

  it("PUT allows highlight=true with 200 when an ongoing season exists", async () => {
    const id = await insertSeries("Guard PUT has-ongoing", false);
    await insertSeason(id, "ongoing");
    const res = await request(app, {
      method: "PUT",
      path: `/series/${id}`,
      headers,
      body: { isOngoingHighlighted: true },
    });
    expect(res.status).toBe(200);
  });

  it("completing last ongoing season via PATCH /seasons clears highlight", async () => {
    const id = await insertSeries("Auto-clear on complete", true);
    const seasonId = await insertSeason(id, "ongoing");
    const res = await request(app, {
      method: "PATCH",
      path: `/seasons/${seasonId}`,
      headers,
      body: { status: "completed" },
    });
    expect(res.status).toBe(200);
    const [row] = await db.select().from(series).where(eq(series.id, id));
    expect(row.isOngoingHighlighted).toBe(false);
  });

  it("deleting last ongoing season via DELETE /seasons clears highlight", async () => {
    const id = await insertSeries("Auto-clear on delete", true);
    const seasonId = await insertSeason(id, "ongoing");
    const res = await request(app, {
      method: "DELETE",
      path: `/seasons/${seasonId}`,
      headers,
    });
    expect(res.status).toBe(200);
    const [row] = await db.select().from(series).where(eq(series.id, id));
    expect(row.isOngoingHighlighted).toBe(false);
  });
});
