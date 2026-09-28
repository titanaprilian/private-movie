import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { authHeaders, buildApp, db, registerUser, request } from "../../utils";
import { storageProviders } from "@repo/db";
import { decryptCredential, encryptCredential } from "@repo/media-service";
import type { MinioSpinUpResponseData } from "@repo/contracts";
import { MinioDockerUnavailableError, MinioHealthTimeoutError } from "@/modules/storage";

function s3AuthError() {
  return Object.assign(new Error("The request signature we calculated does not match"), {
    name: "SignatureDoesNotMatch",
    $fault: "client",
    $metadata: { httpStatusCode: 403 },
  });
}

function defaultRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "existing-default-1",
    name: "Old Default",
    providerType: "backblaze",
    endpoint: "https://s3.old.example.com",
    region: "us-east-1",
    bucket: "old-bucket",
    accessKeyIdEnc: "enc-key",
    secretAccessKeyEnc: "enc-secret",
    publicBaseUrl: null,
    forcePathStyle: false,
    storageLimitGb: 50,
    isDefault: true,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function buildSpinUpApp(overrides: {
  isRunning?: boolean;
  starter?: () => Promise<void>;
  health?: (endpoint: string) => Promise<void>;
  provisioner?: (input: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  }) => Promise<void>;
} = {}) {
  const starter = vi.fn(overrides.starter ?? (async () => {}));
  const health = vi.fn(overrides.health ?? (async () => {}));
  const provisioner = vi.fn(overrides.provisioner ?? (async () => {}));
  const app = await buildApp({
    minioInspector: async () => ({ isAvailable: true, isRunning: overrides.isRunning ?? false }),
    minioContainerStarter: starter,
    minioHealthChecker: health,
    minioBucketProvisioner: provisioner,
  });
  return { app, starter, health, provisioner };
}

describe("MinIO Spin-Up HTTP API (/api/storage/minio/spin-up)", () => {
  it("requires authentication", async () => {
    const { app } = await buildSpinUpApp();
    const res = await request(app, {
      method: "POST",
      path: "/api/storage/minio/spin-up",
      body: {},
    });
    expect(res.status).toBe(401);
  });

  it("starts a stopped container, provisions bucket+CORS, and registers the provider as default", async () => {
    const { app, starter, health, provisioner } = await buildSpinUpApp();
    const { accessToken } = await registerUser(app);
    await db.insert(storageProviders).values([defaultRow()]);

    const res = await request(app, {
      method: "POST",
      path: "/api/storage/minio/spin-up",
      headers: authHeaders(accessToken),
      body: {
        bucket: "private-movie-videos",
        accessKeyId: "TESTACCESSKEY12345",
        secretAccessKey: "test-secret-key-24-chars!!",
        isDefault: true,
      },
    });

    expect(res.status).toBe(200);
    const { data } = res.body as { data: MinioSpinUpResponseData };

    // Container orchestration + readiness
    expect(starter).toHaveBeenCalledTimes(1);
    expect(health).toHaveBeenCalledTimes(1);
    expect(health.mock.calls[0][0]).toContain("9000");

    // S3 bucket + CORS provisioning with path-style addressing
    expect(provisioner).toHaveBeenCalledTimes(1);
    const provisionInput = provisioner.mock.calls[0][0];
    expect(provisionInput.bucket).toBe("private-movie-videos");
    expect(provisionInput.forcePathStyle).toBe(true);
    expect(provisionInput.accessKeyId).toBe("TESTACCESSKEY12345");

    // Response carries the provider, console URL, and plaintext credentials
    expect(data.provider.providerType).toBe("minio");
    expect(data.provider.bucket).toBe("private-movie-videos");
    expect(data.provider.forcePathStyle).toBe(true);
    expect(data.provider.isDefault).toBe(true);
    expect(data.consoleUrl).toContain("9001");
    expect(data.accessKeyId).toBe("TESTACCESSKEY12345");
    expect(data.secretAccessKey).toBe("test-secret-key-24-chars!!");

    // Database: credentials encrypted at rest, old default unset
    const rows = await db.select().from(storageProviders);
    const minioRow = rows.find((r) => r.providerType === "minio");
    expect(minioRow).toBeDefined();
    expect(minioRow!.forcePathStyle).toBe(true);
    expect(decryptCredential(minioRow!.accessKeyIdEnc)).toBe("TESTACCESSKEY12345");
    expect(decryptCredential(minioRow!.secretAccessKeyEnc)).toBe("test-secret-key-24-chars!!");
    const oldDefault = rows.find((r) => r.id === "existing-default-1");
    expect(oldDefault!.isDefault).toBe(false);
    expect(minioRow!.isDefault).toBe(true);
  });

  it("skips container start when already running and defaults to container root credentials", async () => {
    const { app, starter, provisioner } = await buildSpinUpApp({ isRunning: true });
    const { accessToken } = await registerUser(app);

    const res = await request(app, {
      method: "POST",
      path: "/api/storage/minio/spin-up",
      headers: authHeaders(accessToken),
      body: {},
    });

    expect(res.status).toBe(200);
    expect(starter).not.toHaveBeenCalled();
    expect(provisioner).toHaveBeenCalledTimes(1);
    const { data } = res.body as { data: MinioSpinUpResponseData };
    expect(data.provider.bucket).toBe("private-movie-videos");
    // No MINIO_ROOT_* env in test → MinIO compose defaults so bucket auth succeeds
    expect(data.accessKeyId).toBe("minioadmin");
    expect(data.secretAccessKey).toBe("minioadmin");

    const [row] = await db
      .select()
      .from(storageProviders)
      .where(eq(storageProviders.providerType, "minio"));
    expect(row).toBeDefined();
    expect(decryptCredential(row!.accessKeyIdEnc)).toBe("minioadmin");
  });

  it("prefers MINIO_ROOT_* env credentials when request keys are omitted", async () => {
    process.env.MINIO_ROOT_USER = "env-root-user";
    process.env.MINIO_ROOT_PASSWORD = "env-root-pass-123";
    try {
      const { app, provisioner } = await buildSpinUpApp({ isRunning: true });
      const { accessToken } = await registerUser(app);

      const res = await request(app, {
        method: "POST",
        path: "/api/storage/minio/spin-up",
        headers: authHeaders(accessToken),
        body: { bucket: "env-bucket" },
      });

      expect(res.status).toBe(200);
      const { data } = res.body as { data: MinioSpinUpResponseData };
      expect(data.accessKeyId).toBe("env-root-user");
      expect(data.secretAccessKey).toBe("env-root-pass-123");
      expect(provisioner.mock.calls[0][0]).toMatchObject({
        accessKeyId: "env-root-user",
        secretAccessKey: "env-root-pass-123",
      });
    } finally {
      delete process.env.MINIO_ROOT_USER;
      delete process.env.MINIO_ROOT_PASSWORD;
    }
  });

  it("updates the matching provider in place when multiple minio rows exist", async () => {
    const { app, provisioner } = await buildSpinUpApp({ isRunning: true });
    const { accessToken } = await registerUser(app);
    const now = new Date();
    const row = (id: string, endpoint: string, bucket: string) => ({
      id,
      name: `MinIO ${id}`,
      providerType: "minio",
      endpoint,
      region: "us-east-1",
      bucket,
      accessKeyIdEnc: "enc-key",
      secretAccessKeyEnc: "enc-secret",
      publicBaseUrl: null,
      forcePathStyle: true,
      storageLimitGb: 50,
      isDefault: false,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(storageProviders).values([
      row("minio-first", "http://other-host:9000", "other-bucket"),
      row("minio-second", "http://localhost:9000", "private-movie-videos"),
    ]);

    const res = await request(app, {
      method: "POST",
      path: "/api/storage/minio/spin-up",
      headers: authHeaders(accessToken),
      body: {
        accessKeyId: "TESTACCESSKEY12345",
        secretAccessKey: "test-secret-key-24-chars!!",
      },
    });

    expect(res.status).toBe(200);
    expect(provisioner).toHaveBeenCalledTimes(1);
    const { data } = res.body as { data: MinioSpinUpResponseData };
    expect(data.provider.id).toBe("minio-second");

    const rows = await db.select().from(storageProviders);
    expect(rows).toHaveLength(2);
    const updated = rows.find((r) => r.id === "minio-second")!;
    expect(decryptCredential(updated.accessKeyIdEnc)).toBe("TESTACCESSKEY12345");
    expect(updated.isEnabled).toBe(true);
  });

  it("falls back to the server's root credentials when the requested keys are rejected", async () => {
    // The modal sends freshly generated keys, but a pre-existing MinIO server
    // only accepts the root credentials it was initialized with.
    const provisioner = vi.fn(async (input: { accessKeyId: string }) => {
      if (input.accessKeyId !== "minioadmin") throw s3AuthError();
    });
    const { app } = await buildSpinUpApp({ provisioner });
    const { accessToken } = await registerUser(app);

    const res = await request(app, {
      method: "POST",
      path: "/api/storage/minio/spin-up",
      headers: authHeaders(accessToken),
      body: {
        accessKeyId: "TESTACCESSKEY12345",
        secretAccessKey: "test-secret-key-24-chars!!",
        isDefault: true,
      },
    });

    expect(res.status).toBe(200);
    expect(provisioner).toHaveBeenCalledTimes(2);
    const { data } = res.body as { data: MinioSpinUpResponseData };
    expect(data.accessKeyId).toBe("minioadmin");
    expect(data.secretAccessKey).toBe("minioadmin");

    // The working credentials — not the rejected ones — are stored.
    const [row] = await db
      .select()
      .from(storageProviders)
      .where(eq(storageProviders.providerType, "minio"));
    expect(decryptCredential(row!.accessKeyIdEnc)).toBe("minioadmin");
    expect(decryptCredential(row!.secretAccessKeyEnc)).toBe("minioadmin");
  });

  it("prefers stored provider credentials over MinIO defaults during fallback", async () => {
    const provisioner = vi.fn(async (input: { accessKeyId: string }) => {
      if (input.accessKeyId !== "stored-root-user") throw s3AuthError();
    });
    const { app } = await buildSpinUpApp({ provisioner });
    const { accessToken } = await registerUser(app);
    const now = new Date();
    await db.insert(storageProviders).values([
      {
        id: "minio-stored",
        name: "Local MinIO",
        providerType: "minio",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "private-movie-videos",
        accessKeyIdEnc: encryptCredential("stored-root-user"),
        secretAccessKeyEnc: encryptCredential("stored-root-pass-123"),
        publicBaseUrl: null,
        forcePathStyle: true,
        storageLimitGb: 50,
        isDefault: false,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const res = await request(app, {
      method: "POST",
      path: "/api/storage/minio/spin-up",
      headers: authHeaders(accessToken),
      body: {
        accessKeyId: "TESTACCESSKEY12345",
        secretAccessKey: "test-secret-key-24-chars!!",
      },
    });

    expect(res.status).toBe(200);
    expect(provisioner).toHaveBeenCalledTimes(2);
    const { data } = res.body as { data: MinioSpinUpResponseData };
    expect(data.accessKeyId).toBe("stored-root-user");
    expect(data.secretAccessKey).toBe("stored-root-pass-123");
  });

  it("returns 502 with guidance when every credential candidate is rejected", async () => {
    const provisioner = vi.fn(async () => {
      throw s3AuthError();
    });
    const { app } = await buildSpinUpApp({ provisioner });
    const { accessToken } = await registerUser(app);

    const res = await request(app, {
      method: "POST",
      path: "/api/storage/minio/spin-up",
      headers: authHeaders(accessToken),
      body: {},
    });

    expect(res.status).toBe(502);
    const errBody = res.body as { error: { code: string; message: string } };
    expect(errBody.error.code).toBe("MINIO_CREDENTIALS_REJECTED");
    expect(errBody.error.message).toMatch(/rejected/i);
  });

  it("fails fast without fallback on non-auth provisioning errors", async () => {
    const provisioner = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:9000");
    });
    const { app } = await buildSpinUpApp({ provisioner });
    const { accessToken } = await registerUser(app);

    const res = await request(app, {
      method: "POST",
      path: "/api/storage/minio/spin-up",
      headers: authHeaders(accessToken),
      body: {},
    });

    expect(res.status).toBe(500);
    expect(provisioner).toHaveBeenCalledTimes(1);
  });

  it("returns 503 with guidance when Docker is unavailable and 504 on health timeout", async () => {
    const dockerApp = await buildApp({
      minioInspector: async () => ({ isAvailable: false, isRunning: false }),
      minioContainerStarter: async () => {
        throw new MinioDockerUnavailableError();
      },
      minioHealthChecker: async () => {},
      minioBucketProvisioner: async () => {},
    });
    const { accessToken } = await registerUser(dockerApp);
    const dockerRes = await request(dockerApp, {
      method: "POST",
      path: "/api/storage/minio/spin-up",
      headers: authHeaders(accessToken),
      body: {},
    });
    expect(dockerRes.status).toBe(503);

    const healthApp = await buildApp({
      minioInspector: async () => ({ isAvailable: true, isRunning: true }),
      minioContainerStarter: async () => {},
      minioHealthChecker: async () => {
        throw new MinioHealthTimeoutError();
      },
      minioBucketProvisioner: async () => {},
    });
    const secondUser = await registerUser(healthApp);
    const healthRes = await request(healthApp, {
      method: "POST",
      path: "/api/storage/minio/spin-up",
      headers: authHeaders(secondUser.accessToken),
      body: {},
    });
    expect(healthRes.status).toBe(504);
  });
});
