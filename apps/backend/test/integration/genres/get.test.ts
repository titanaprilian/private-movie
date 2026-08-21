import { describe, expect, it, beforeAll } from "vitest";
import { genres } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
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

describe("GET /genres", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns empty array when database contains 0 genres", async () => {
    const response = await request(app, { path: "/genres" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: unknown[];
    };

    expect(body.data).toEqual([]);
  });

  it("returns all genres when database contains genre records", async () => {
    const genre1 = await insertGenreRow({ name: "Action", slug: "action" });
    const genre2 = await insertGenreRow({ name: "Drama", slug: "drama" });

    const response = await request(app, { path: "/genres" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: { id: string; name: string; slug: string }[];
    };

    expect(body.data).toHaveLength(2);
    const ids = body.data.map((g) => g.id);
    expect(ids).toContain(genre1.id);
    expect(ids).toContain(genre2.id);
  });
});
