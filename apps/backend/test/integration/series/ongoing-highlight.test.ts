import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { seasons, series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";

async function insertOngoingSeries(options: {
  title: string;
  isOngoingHighlighted?: boolean;
  updatedAt?: Date;
}): Promise<{ id: string; title: string }> {
  const id = crypto.randomUUID();
  const now = options.updatedAt ?? new Date();

  await db.insert(series).values({
    id,
    title: options.title,
    description: `${options.title} description`,
    posterUrl: "https://example.com/poster.jpg",
    isOngoingHighlighted: options.isOngoingHighlighted ?? false,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(seasons).values({
    id: crypto.randomUUID(),
    seriesId: id,
    title: `${options.title} Season 1`,
    status: "ongoing",
    createdAt: now,
    updatedAt: now,
  });

  return { id, title: options.title };
}

describe("Ongoing highlight curation", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("PUT /series/:id persists isOngoingHighlighted", async () => {
    const { accessToken } = await registerUser(app);
    const s = await insertOngoingSeries({ title: "Highlight PUT Series" });

    const response = await request(app, {
      method: "PUT",
      path: `/series/${s.id}`,
      headers: authHeaders(accessToken),
      body: { isOngoingHighlighted: true },
    });

    expect(response.status).toBe(200);
    const body = response.body as { data: { isOngoingHighlighted: boolean } };
    expect(body.data.isOngoingHighlighted).toBe(true);

    const [row] = await db.select().from(series).where(eq(series.id, s.id));
    expect(row.isOngoingHighlighted).toBe(true);
  });

  it("PATCH /series/:id persists isOngoingHighlighted", async () => {
    const { accessToken } = await registerUser(app);
    const s = await insertOngoingSeries({
      title: "Highlight PATCH Series",
      isOngoingHighlighted: true,
    });

    const response = await request(app, {
      method: "PATCH",
      path: `/series/${s.id}`,
      headers: authHeaders(accessToken),
      body: { isOngoingHighlighted: false },
    });

    expect(response.status).toBe(200);
    const body = response.body as { data: { isOngoingHighlighted: boolean } };
    expect(body.data.isOngoingHighlighted).toBe(false);

    const [row] = await db.select().from(series).where(eq(series.id, s.id));
    expect(row.isOngoingHighlighted).toBe(false);
  });

  it("GET /series?filter=ongoing&highlighted=true returns only highlighted series", async () => {
    await insertOngoingSeries({ title: "Highlighted Only A", isOngoingHighlighted: true });
    await insertOngoingSeries({ title: "Plain Ongoing B" });

    const response = await request(app, {
      path: "/series?filter=ongoing&highlighted=true",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: { series: { title: string; isOngoingHighlighted: boolean }[] };
    };
    const titles = body.data.series.map((s) => s.title);
    expect(titles).toContain("Highlighted Only A");
    expect(titles).not.toContain("Plain Ongoing B");
    for (const item of body.data.series) {
      expect(item.isOngoingHighlighted).toBe(true);
    }
  });

  it("GET /series?filter=ongoing sorts highlighted series first", async () => {
    await insertOngoingSeries({
      title: "Older Plain Ongoing",
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    await insertOngoingSeries({
      title: "Newer Highlighted Ongoing",
      isOngoingHighlighted: true,
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    await insertOngoingSeries({
      title: "Newest Plain Ongoing",
      updatedAt: new Date("2026-01-03T00:00:00Z"),
    });

    const response = await request(app, {
      path: "/series?filter=ongoing",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: { series: { title: string; isOngoingHighlighted: boolean }[] };
    };
    const titles = body.data.series.map((s) => s.title);
    const highlightedIdx = titles.indexOf("Newer Highlighted Ongoing");
    expect(highlightedIdx).toBe(0);
    expect(titles.indexOf("Newest Plain Ongoing")).toBeGreaterThan(highlightedIdx);
    expect(titles.indexOf("Older Plain Ongoing")).toBeGreaterThan(highlightedIdx);
  });
});
