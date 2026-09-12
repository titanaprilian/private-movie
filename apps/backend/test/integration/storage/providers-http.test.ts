import { describe, expect, it } from "vitest";
import {
  authHeaders,
  buildApp,
  db,
  registerUser,
  request,
} from "../../utils";
import { storageProviders, videoSources, episodes, seasons, series } from "@repo/db";
import { eq } from "drizzle-orm";
import { decryptCredential } from "@repo/media-service";
import type { StorageProviderMasked } from "@repo/contracts";

describe("Storage Providers HTTP API (/api/storage/providers)", () => {

  it("requires authentication for provider routes", async () => {
    const app = await buildApp();

    const getRes = await request(app, {
      method: "GET",
      path: "/api/storage/providers",
    });
    expect(getRes.status).toBe(401);

    const postRes = await request(app, {
      method: "POST",
      path: "/api/storage/providers",
      body: {
        name: "Test",
        providerType: "custom",
        endpoint: "https://s3.example.com",
        region: "us-east-1",
        bucket: "my-bucket",
        accessKeyId: "key",
        secretAccessKey: "secret",
      },
    });
    expect(postRes.status).toBe(401);
  });

  it("creates a new storage provider with encrypted credentials and returns masked accessKeyId", async () => {
    const app = await buildApp();
    const { accessToken } = await registerUser(app);

    const payload = {
      name: "Cloudflare R2 Production",
      providerType: "cloudflare_r2",
      endpoint: "https://r2.cloudflarestorage.com",
      region: "auto",
      bucket: "my-r2-bucket",
      accessKeyId: "MY_SECRET_KEY_ID_12345",
      secretAccessKey: "SUPER_SECRET_VALUE_XYZ",
      publicBaseUrl: "https://media.mycdn.com",
      forcePathStyle: true,
      storageLimitGb: 100,
      isDefault: true,
      isEnabled: true,
    };

    const res = await request(app, {
      method: "POST",
      path: "/api/storage/providers",
      headers: authHeaders(accessToken),
      body: payload,
    });

    expect(res.status).toBe(200);
    const { data } = res.body as { data: StorageProviderMasked };
    expect(data.id).toBeDefined();
    expect(data.name).toBe(payload.name);
    expect(data.accessKeyIdMasked).toBe("••••••••2345");
    expect(data.publicBaseUrl).toBe("https://media.mycdn.com");
    expect(data.isDefault).toBe(true);

    // Verify DB record stores encrypted strings, not plaintext
    const [dbRow] = await db
      .select()
      .from(storageProviders)
      .where(eq(storageProviders.id, data.id));

    expect(dbRow).toBeDefined();
    expect(dbRow.accessKeyIdEnc).not.toBe(payload.accessKeyId);
    expect(dbRow.secretAccessKeyEnc).not.toBe(payload.secretAccessKey);

    // Verify decrypted matches original
    expect(decryptCredential(dbRow.accessKeyIdEnc)).toBe(payload.accessKeyId);
    expect(decryptCredential(dbRow.secretAccessKeyEnc)).toBe(payload.secretAccessKey);
  });

  it("lists providers with linked source counts", async () => {
    const app = await buildApp();
    const { accessToken } = await registerUser(app);

    // Create provider
    const createRes = await request(app, {
      method: "POST",
      path: "/api/storage/providers",
      headers: authHeaders(accessToken),
      body: {
        name: "Wasabi East",
        providerType: "wasabi",
        endpoint: "https://s3.wasabisys.com",
        region: "us-east-1",
        bucket: "wasabi-bucket",
        accessKeyId: "WASABI_KEY",
        secretAccessKey: "WASABI_SECRET",
      },
    });
    const { data: createdProv } = createRes.body as { data: StorageProviderMasked };

    // Insert a video source linked to this provider
    const now = new Date();
    const [ser] = await db
      .insert(series)
      .values({
        id: "ser-1",
        title: "Test Series",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const [sea] = await db
      .insert(seasons)
      .values({
        id: "sea-1",
        seriesId: ser.id,
        title: "Season 1",
        seasonNumber: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const [ep] = await db
      .insert(episodes)
      .values({
        id: "ep-1",
        seasonId: sea.id,
        title: "Episode 1",
        order: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db.insert(videoSources).values({
      id: "vs-1",
      episodeId: ep.id,
      type: "s3",
      url: "episodes/ep-1/test.mp4",
      label: "Wasabi 1080p",
      storageProviderId: createdProv.id,
      createdAt: now,
      updatedAt: now,
    });

    const listRes = await request(app, {
      method: "GET",
      path: "/api/storage/providers",
      headers: authHeaders(accessToken),
    });

    expect(listRes.status).toBe(200);
    const { data: providersList } = listRes.body as { data: StorageProviderMasked[] };
    const target = providersList.find((p) => p.id === createdProv.id);
    expect(target).toBeDefined();
    expect(target?.linkedSourcesCount).toBe(1);
  });

  it("updates provider details and default status", async () => {
    const app = await buildApp();
    const { accessToken } = await registerUser(app);

    const createRes = await request(app, {
      method: "POST",
      path: "/api/storage/providers",
      headers: authHeaders(accessToken),
      body: {
        name: "MinIO Local",
        providerType: "minio",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "local-bucket",
        accessKeyId: "MINIO_USER",
        secretAccessKey: "MINIO_PASS",
      },
    });
    const { data: createdProv } = createRes.body as { data: StorageProviderMasked };

    const updateRes = await request(app, {
      method: "PUT",
      path: `/api/storage/providers/${createdProv.id}`,
      headers: authHeaders(accessToken),
      body: {
        name: "MinIO Local Updated",
        storageLimitGb: 200,
        isDefault: true,
      },
    });

    expect(updateRes.status).toBe(200);
    const { data: updatedProv } = updateRes.body as { data: StorageProviderMasked };
    expect(updatedProv.name).toBe("MinIO Local Updated");
    expect(updatedProv.storageLimitGb).toBe(200);
    expect(updatedProv.isDefault).toBe(true);
  });

  it("prevents deleting a provider with linked video sources (409 Conflict)", async () => {
    const app = await buildApp();
    const { accessToken } = await registerUser(app);

    const createRes = await request(app, {
      method: "POST",
      path: "/api/storage/providers",
      headers: authHeaders(accessToken),
      body: {
        name: "B2 Main",
        providerType: "backblaze",
        endpoint: "https://s3.us-east-005.backblazeb2.com",
        region: "us-east-005",
        bucket: "b2-bucket",
        accessKeyId: "B2_KEY",
        secretAccessKey: "B2_SECRET",
      },
    });
    const { data: prov } = createRes.body as { data: StorageProviderMasked };

    // Link a video source
    const now = new Date();
    const [ser] = await db
      .insert(series)
      .values({ id: "ser-2", title: "S2", createdAt: now, updatedAt: now })
      .returning();
    const [sea] = await db
      .insert(seasons)
      .values({ id: "sea-2", seriesId: ser.id, title: "S2", createdAt: now, updatedAt: now })
      .returning();
    const [ep] = await db
      .insert(episodes)
      .values({ id: "ep-2", seasonId: sea.id, title: "E2", order: 1, createdAt: now, updatedAt: now })
      .returning();

    await db.insert(videoSources).values({
      id: "vs-2",
      episodeId: ep.id,
      type: "s3",
      url: "episodes/ep-2/vid.mp4",
      label: "B2 1080p",
      storageProviderId: prov.id,
      createdAt: now,
      updatedAt: now,
    });

    const deleteRes = await request(app, {
      method: "DELETE",
      path: `/api/storage/providers/${prov.id}`,
      headers: authHeaders(accessToken),
    });

    expect(deleteRes.status).toBe(409);
    const body = deleteRes.body as { error: { message: string } };
    expect(body.error.message).toContain("linked video sources");

    // Remove the video source, then deletion should succeed
    await db.delete(videoSources).where(eq(videoSources.id, "vs-2"));

    const deleteRes2 = await request(app, {
      method: "DELETE",
      path: `/api/storage/providers/${prov.id}`,
      headers: authHeaders(accessToken),
    });

    expect(deleteRes2.status).toBe(200);
  });

  it("tests connection via /storage/providers/test", async () => {
    const app = await buildApp();
    const { accessToken } = await registerUser(app);

    const testRes = await request(app, {
      method: "POST",
      path: "/api/storage/providers/test",
      headers: authHeaders(accessToken),
      body: {
        endpoint: "https://mock.s3.test",
        region: "us-east-1",
        bucket: "test-bucket",
        accessKeyId: "mock-key",
        secretAccessKey: "mock-secret",
      },
    });

    // Test will attempt live or mock connection
    expect(testRes.status).toBe(200);
    const { data } = testRes.body as { data: { success: boolean } };
    expect(typeof data.success).toBe("boolean");
  });
});
