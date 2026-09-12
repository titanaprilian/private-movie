import { describe, expect, it } from "vitest";
import { db } from "../../utils";
import { autoSeedDefaultProviderAndBackfill } from "../../../src/modules/storage";
import { storageProviders, videoSources, episodes, seasons, series } from "@repo/db";
import { eq } from "drizzle-orm";
import { decryptCredential } from "@repo/media-service";

describe("Startup Legacy S3 Provider Auto-Seed & Backfill", () => {

  it("seeds default provider from env vars and backfills legacy S3 sources", async () => {
    // Set mock env vars
    process.env.S3_ENDPOINT = "https://s3.legacy.example.com";
    process.env.S3_REGION = "us-west-002";
    process.env.S3_BUCKET = "legacy-bucket";
    process.env.S3_ACCESS_KEY_ID = "LEGACY_KEY_123";
    process.env.S3_SECRET_ACCESS_KEY = "LEGACY_SECRET_456";

    // Insert an unlinked legacy s3 source
    const now = new Date();
    const [ser] = await db
      .insert(series)
      .values({ id: "ser-legacy", title: "Legacy Series", createdAt: now, updatedAt: now })
      .returning();
    const [sea] = await db
      .insert(seasons)
      .values({ id: "sea-legacy", seriesId: ser.id, title: "Season 1", seasonNumber: 1, createdAt: now, updatedAt: now })
      .returning();
    const [ep] = await db
      .insert(episodes)
      .values({ id: "ep-legacy", seasonId: sea.id, title: "Episode 1", order: 1, createdAt: now, updatedAt: now })
      .returning();

    const [unlinkedSource] = await db
      .insert(videoSources)
      .values({
        id: "vs-legacy",
        episodeId: ep.id,
        type: "s3",
        url: "episodes/ep-legacy/video.mp4",
        label: "Legacy Video",
        storageProviderId: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    expect(unlinkedSource.storageProviderId).toBeNull();

    // Run auto-seed
    const seededId = await autoSeedDefaultProviderAndBackfill(db);
    expect(seededId).toBeDefined();

    // Verify provider row in DB
    const [prov] = await db
      .select()
      .from(storageProviders)
      .where(eq(storageProviders.id, seededId!));

    expect(prov).toBeDefined();
    expect(prov.isDefault).toBe(true);
    expect(prov.endpoint).toBe("https://s3.legacy.example.com");
    expect(decryptCredential(prov.accessKeyIdEnc)).toBe("LEGACY_KEY_123");
    expect(decryptCredential(prov.secretAccessKeyEnc)).toBe("LEGACY_SECRET_456");

    // Verify backfilled source
    const [updatedSource] = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.id, "vs-legacy"));

    expect(updatedSource.storageProviderId).toBe(seededId);

    // Running again does nothing because table is not empty
    const secondRun = await autoSeedDefaultProviderAndBackfill(db);
    expect(secondRun).toBeNull();
  });
});
