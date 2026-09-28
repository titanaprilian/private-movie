import { describe, expect, it } from "vitest";
import { authHeaders, buildApp, db, registerUser, request } from "../../utils";
import { storageProviders } from "@repo/db";
import type { MinioStatusResponseData } from "@repo/contracts";

function minioRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "minio-prov-1",
    name: "Local MinIO",
    providerType: "minio",
    endpoint: "http://localhost:9000",
    region: "us-east-1",
    bucket: "private-movie-videos",
    accessKeyIdEnc: "enc-key",
    secretAccessKeyEnc: "enc-secret",
    publicBaseUrl: null,
    forcePathStyle: true,
    storageLimitGb: 50,
    isDefault: true,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("MinIO Status HTTP API (/api/storage/minio/status)", () => {
  it("requires authentication", async () => {
    const app = await buildApp({
      minioInspector: async () => ({ isAvailable: true, isRunning: true }),
    });
    const res = await request(app, {
      method: "GET",
      path: "/api/storage/minio/status",
    });
    expect(res.status).toBe(401);
  });

  it("reports running + configured state with provider details", async () => {
    const app = await buildApp({
      minioInspector: async () => ({ isAvailable: true, isRunning: true }),
    });
    const { accessToken } = await registerUser(app);
    await db.insert(storageProviders).values([minioRow()]);

    const res = await request(app, {
      method: "GET",
      path: "/api/storage/minio/status",
      headers: authHeaders(accessToken),
    });

    expect(res.status).toBe(200);
    const { data } = res.body as { data: MinioStatusResponseData };
    expect(data.isAvailable).toBe(true);
    expect(data.isRunning).toBe(true);
    expect(data.isConfigured).toBe(true);
    expect(data.providerId).toBe("minio-prov-1");
    expect(data.endpoint).toBe("http://localhost:9000");
    expect(data.bucket).toBe("private-movie-videos");
    expect(data.consoleUrl).toBeDefined();
  });

  it("reports stopped container state and running-but-unconfigured state", async () => {
    // Stopped + configured
    const stoppedApp = await buildApp({
      minioInspector: async () => ({ isAvailable: true, isRunning: false }),
    });
    const { accessToken } = await registerUser(stoppedApp);
    await db.insert(storageProviders).values([minioRow()]);

    const stoppedRes = await request(stoppedApp, {
      method: "GET",
      path: "/api/storage/minio/status",
      headers: authHeaders(accessToken),
    });
    expect(stoppedRes.status).toBe(200);
    const stopped = (stoppedRes.body as { data: MinioStatusResponseData }).data;
    expect(stopped.isAvailable).toBe(true);
    expect(stopped.isRunning).toBe(false);
    expect(stopped.isConfigured).toBe(true);

    // Running, no provider row — clear the row inserted above within this test
    // (truncation only runs between tests, not between blocks in one test).
    await db.delete(storageProviders);
    const runningApp = await buildApp({
      minioInspector: async () => ({ isAvailable: true, isRunning: true }),
    });
    const secondUser = await registerUser(runningApp);
    const runningRes = await request(runningApp, {
      method: "GET",
      path: "/api/storage/minio/status",
      headers: authHeaders(secondUser.accessToken),
    });
    expect(runningRes.status).toBe(200);
    const running = (runningRes.body as { data: MinioStatusResponseData }).data;
    expect(running.isAvailable).toBe(true);
    expect(running.isRunning).toBe(true);
    expect(running.isConfigured).toBe(false);
    expect(running.providerId).toBeUndefined();
  });

  it("reports unavailable when docker socket is missing", async () => {
    const app = await buildApp({
      minioInspector: async () => ({ isAvailable: false, isRunning: false }),
    });
    const { accessToken } = await registerUser(app);

    const res = await request(app, {
      method: "GET",
      path: "/api/storage/minio/status",
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const { data } = res.body as { data: MinioStatusResponseData };
    expect(data.isAvailable).toBe(false);
    expect(data.isRunning).toBe(false);
    expect(data.isConfigured).toBe(false);
  });

  it("prefers the enabled default provider when multiple minio records exist", async () => {
    const app = await buildApp({
      minioInspector: async () => ({ isAvailable: true, isRunning: true }),
    });
    const { accessToken } = await registerUser(app);
    await db.insert(storageProviders).values([
      minioRow({ id: "minio-disabled-default", isDefault: true, isEnabled: false }),
      minioRow({ id: "minio-active", isDefault: false, isEnabled: true }),
    ]);

    const res = await request(app, {
      method: "GET",
      path: "/api/storage/minio/status",
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const { data } = res.body as { data: MinioStatusResponseData };
    expect(data.isConfigured).toBe(true);
    expect(data.providerId).toBe("minio-active");
  });
});
