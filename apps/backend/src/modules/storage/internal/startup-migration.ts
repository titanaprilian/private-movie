import { randomUUID } from "node:crypto";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { and, eq, isNull } from "drizzle-orm";
import { storageProviders, videoSources } from "@repo/db";
import { encryptCredential } from "@repo/media-service";

export async function autoSeedDefaultProviderAndBackfill<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>): Promise<string | null> {
  // Check if storage_providers has any rows
  const existingProviders = await db.select().from(storageProviders).limit(1);
  if (existingProviders.length > 0) {
    return null;
  }

  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  // If legacy S3 credentials exist, seed the default provider row
  if (endpoint && bucket && accessKeyId && secretAccessKey) {
    const region = process.env.S3_REGION?.trim() || "auto";
    const now = new Date();
    const providerId = randomUUID();

    const accessKeyIdEnc = encryptCredential(accessKeyId);
    const secretAccessKeyEnc = encryptCredential(secretAccessKey);

    await db.insert(storageProviders).values({
      id: providerId,
      name: "Default S3 Storage",
      providerType: "custom",
      endpoint,
      region,
      bucket,
      accessKeyIdEnc,
      secretAccessKeyEnc,
      publicBaseUrl: null,
      forcePathStyle: false,
      storageLimitGb: 50,
      isDefault: true,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    });

    // Backfill any unlinked S3 video sources to point to this provider
    await db
      .update(videoSources)
      .set({
        storageProviderId: providerId,
        updatedAt: now,
      })
      .where(
        and(
          eq(videoSources.type, "s3"),
          isNull(videoSources.storageProviderId)
        )
      );

    return providerId;
  }

  return null;
}
