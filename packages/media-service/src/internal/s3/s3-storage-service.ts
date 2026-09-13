import { type Readable } from "node:stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  ListMultipartUploadsCommand,
  AbortMultipartUploadCommand,
  type ListObjectVersionsCommandOutput,
  type ListMultipartUploadsCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";

export interface S3StorageServiceOptions {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  presignedGetExpiresIn?: number;
  forcePathStyle?: boolean;
  publicBaseUrl?: string | null;
}

export interface StreamUploadOptions {
  contentType?: string;
  onProgress?: (progress: { loaded: number; total?: number }) => void;
  signal?: AbortSignal;
}

export interface S3ObjectSummary {
  key: string;
  size: number;
  lastModified: Date;
  eTag?: string;
}

export interface ListObjectsOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListObjectsResult {
  objects: S3ObjectSummary[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

export interface BucketStorageUsage {
  totalSizeBytes: number;
  objectCount: number;
}

export interface PurgeDanglingResult {
  purgedVersionsCount: number;
  purgedDeleteMarkersCount: number;
}

export interface AbortStaleMultipartUploadsOptions {
  prefix?: string;
  maxAgeSeconds?: number;
}

export interface AbortStaleMultipartUploadsResult {
  abortedUploadsCount: number;
}

export interface S3StorageService {
  isConfigured(): boolean;
  getPresignedUploadUrl(key: string, contentType?: string): Promise<{ uploadUrl: string; key: string }>;
  getPresignedPlaybackUrl(key: string, expiresInSeconds?: number): Promise<string>;
  uploadObject(
    key: string,
    body: ReadableStream | Buffer | Blob | Uint8Array,
    contentType?: string
  ): Promise<void>;
  uploadStream(
    key: string,
    body: ReadableStream | Readable,
    options?: StreamUploadOptions
  ): Promise<void>;
  deleteObject(key: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
  listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult>;
  listAllObjects(prefix?: string): Promise<S3ObjectSummary[]>;
  getBucketStorageUsage(): Promise<BucketStorageUsage>;
  purgeDanglingVersions(prefix?: string): Promise<PurgeDanglingResult>;
  abortStaleMultipartUploads(options?: AbortStaleMultipartUploadsOptions): Promise<AbortStaleMultipartUploadsResult>;
  testConnection(): Promise<{ success: boolean; latencyMs: number }>;
  getPublicBaseUrl(): string | null;
}

export class S3NotConfiguredError extends Error {
  constructor(message = "S3 storage service is not configured") {
    super(message);
    this.name = "S3NotConfiguredError";
  }
}

/**
 * Extract the raw S3 object key from a stored video source URL.
 *
 * The `video_sources.url` column stores the object key (e.g.
 * `episodes/{episodeId}/{filename}`) when `type` is `"s3"`, but older rows
 * may hold `s3://bucket/key` URIs. Best-effort handling:
 * - `s3://bucket/key` -> `key`
 * - `s3://key` -> `key`
 * - `https://.../<key>?query` -> `<key>` (pathname without leading slash)
 * - plain keys (with optional leading slash) -> trimmed as-is
 */
export function extractS3Key(storedUrl: string): string {
  if (!storedUrl) return "";
  const trimmed = storedUrl.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("s3://")) {
    const withoutScheme = trimmed.slice("s3://".length);
    const parts = withoutScheme.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    // Assume first segment is the bucket name, rest is the key.
    return parts.slice(1).join("/");
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const pathname = parsed.pathname.replace(/^\/+/, "");
      if (!pathname) return "";
      const segments = pathname.split("/").filter(Boolean);
      // Path-style S3 URLs embed the bucket as the first segment
      // (`/bucket/key`). Without bucket knowledge we cannot reliably strip
      // it, so return the full path — the caller best-effort deletes it.
      // If the URL looks like a presigned B2 URL with only the key path,
      // this is exactly the key.
      void segments;
      return pathname;
    } catch {
      return trimmed;
    }
  }

  return trimmed.replace(/^\/+/, "");
}

class DefaultS3StorageService implements S3StorageService {
  private readonly client: S3Client | null = null;
  private readonly bucket: string;
  private readonly defaultExpiresIn: number;
  private readonly configured: boolean;
  private readonly publicBaseUrl: string | null;

  constructor(options?: S3StorageServiceOptions) {
    let endpoint = (options?.endpoint ?? process.env.S3_ENDPOINT ?? "").trim();
    if (endpoint && !endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
      endpoint = `https://${endpoint}`;
    }
    const region = (options?.region ?? process.env.S3_REGION ?? "us-east-005").trim();
    const bucket = (options?.bucket ?? process.env.S3_BUCKET ?? "").trim();
    const accessKeyId = (options?.accessKeyId ?? process.env.S3_ACCESS_KEY_ID ?? "").trim();
    const secretAccessKey = (
      options?.secretAccessKey ?? process.env.S3_SECRET_ACCESS_KEY ?? ""
    ).trim();

    const envExpires = process.env.S3_PRESIGNED_GET_EXPIRES_IN;
    const defaultGetExpires = options?.presignedGetExpiresIn ?? (envExpires ? Number(envExpires) : 21600);

    this.bucket = bucket;
    this.defaultExpiresIn = Number.isNaN(defaultGetExpires) ? 21600 : defaultGetExpires;
    this.publicBaseUrl = options?.publicBaseUrl ? options.publicBaseUrl.trim().replace(/\/+$/, "") : null;

    if (endpoint && bucket && accessKeyId && secretAccessKey) {
      this.configured = true;
      this.client = new S3Client({
        endpoint,
        region,
        forcePathStyle: options?.forcePathStyle ?? false,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        // Backblaze B2 S3 compatibility: disable flexible checksums on presigned URLs
        // and force path-style or standard addressing
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      });
    } else {
      this.configured = false;
      this.client = null;
    }
  }

  getPublicBaseUrl(): string | null {
    return this.publicBaseUrl;
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number }> {
    const client = this.ensureConfigured();
    const startTime = Date.now();
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });
      await client.send(command);
      return {
        success: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      throw Object.assign(
        error instanceof Error ? error : new Error(String(error)),
        { latencyMs }
      );
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private ensureConfigured(): S3Client {
    if (!this.configured || !this.client) {
      throw new S3NotConfiguredError();
    }
    return this.client;
  }

  async getPresignedUploadUrl(
    key: string,
    contentType?: string
  ): Promise<{ uploadUrl: string; key: string }> {
    const client = this.ensureConfigured();
    if (!key) {
      throw new Error("Key is required for presigned upload URL");
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(contentType ? { ContentType: contentType } : {}),
    });

    // Sign with unhoisted or standard parameters
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: 3600,
      unhoistableHeaders: new Set(["x-id"]),
    });
    return { uploadUrl, key };
  }

  async getPresignedPlaybackUrl(
    key: string,
    expiresInSeconds?: number
  ): Promise<string> {
    const client = this.ensureConfigured();
    if (!key) {
      throw new Error("Key is required for presigned playback URL");
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const expiresIn = expiresInSeconds ?? this.defaultExpiresIn;
    return await getSignedUrl(client, command, { expiresIn });
  }

  async uploadObject(
    key: string,
    body: ReadableStream | Buffer | Blob | Uint8Array,
    contentType?: string
  ): Promise<void> {
    const client = this.ensureConfigured();
    if (!key) {
      throw new Error("Key is required for uploadObject");
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
    });

    await client.send(command);
  }

  async uploadStream(
    key: string,
    body: ReadableStream | Readable,
    options?: StreamUploadOptions
  ): Promise<void> {
    const client = this.ensureConfigured();
    if (!key) {
      throw new Error("Key is required for uploadStream");
    }

    const upload = new Upload({
      client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ...(options?.contentType ? { ContentType: options.contentType } : {}),
      },
      queueSize: 4,
      partSize: 10 * 1024 * 1024,
    });

    if (options?.onProgress) {
      upload.on("httpUploadProgress", (progress) => {
        if (progress.loaded != null) {
          options.onProgress!({
            loaded: progress.loaded,
            total: progress.total,
          });
        }
      });
    }

    if (options?.signal) {
      if (options.signal.aborted) {
        await upload.abort();
        throw options.signal.reason || new Error("Upload aborted");
      }

      const onAbort = () => {
        upload.abort().catch(() => {});
      };

      options.signal.addEventListener("abort", onAbort, { once: true });
      try {
        await upload.done();
        if (options.signal.aborted) {
          throw options.signal.reason || new Error("Upload aborted");
        }
      } catch (err) {
        if (options.signal.aborted) {
          throw options.signal.reason || new Error("Upload aborted");
        }
        throw err;
      } finally {
        options.signal.removeEventListener("abort", onAbort);
      }
    } else {
      await upload.done();
    }
  }

  async deleteObject(key: string): Promise<void> {
    const client = this.ensureConfigured();
    if (!key) return;

    // Hard delete: remove all versions and delete markers for this key
    try {
      let keyMarker: string | undefined = undefined;
      let versionIdMarker: string | undefined = undefined;
      do {
        const versionsRes: ListObjectVersionsCommandOutput = await client.send(
          new ListObjectVersionsCommand({
            Bucket: this.bucket,
            Prefix: key,
            KeyMarker: keyMarker,
            VersionIdMarker: versionIdMarker,
          })
        );

        const toDelete: Array<{ Key: string; VersionId?: string }> = [];
        for (const v of versionsRes.Versions ?? []) {
          if (v.Key === key) {
            toDelete.push({ Key: v.Key, VersionId: v.VersionId });
          }
        }
        for (const dm of versionsRes.DeleteMarkers ?? []) {
          if (dm.Key === key) {
            toDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
          }
        }

        if (toDelete.length > 0) {
          // Delete up to 1000 items per request
          for (let i = 0; i < toDelete.length; i += 1000) {
            const batch = toDelete.slice(i, i + 1000);
            await client.send(
              new DeleteObjectsCommand({
                Bucket: this.bucket,
                Delete: {
                  Objects: batch,
                  Quiet: true,
                },
              })
            );
          }
        }

        if (versionsRes.IsTruncated) {
          keyMarker = versionsRes.NextKeyMarker;
          versionIdMarker = versionsRes.NextVersionIdMarker;
        } else {
          keyMarker = undefined;
          versionIdMarker = undefined;
        }
      } while (keyMarker || versionIdMarker);
    } catch {
      // Best-effort if bucket does not support or error occurred listing versions
    }

    // Always attempt DeleteObjectCommand as base / fallback deletion
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await client.send(command);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    const client = this.ensureConfigured();
    if (!keys || keys.length === 0) return;

    const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
    if (uniqueKeys.length === 0) return;

    // Hard delete: remove all versions and delete markers for all keys
    try {
      const allToDelete: Array<{ Key: string; VersionId?: string }> = [];
      for (const key of uniqueKeys) {
        let keyMarker: string | undefined = undefined;
        let versionIdMarker: string | undefined = undefined;
        do {
          const versionsRes: ListObjectVersionsCommandOutput = await client.send(
            new ListObjectVersionsCommand({
              Bucket: this.bucket,
              Prefix: key,
              KeyMarker: keyMarker,
              VersionIdMarker: versionIdMarker,
            })
          );

          for (const v of versionsRes.Versions ?? []) {
            if (v.Key === key) {
              allToDelete.push({ Key: v.Key, VersionId: v.VersionId });
            }
          }
          for (const dm of versionsRes.DeleteMarkers ?? []) {
            if (dm.Key === key) {
              allToDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
            }
          }

          if (versionsRes.IsTruncated) {
            keyMarker = versionsRes.NextKeyMarker;
            versionIdMarker = versionsRes.NextVersionIdMarker;
          } else {
            keyMarker = undefined;
            versionIdMarker = undefined;
          }
        } while (keyMarker || versionIdMarker);
      }

      if (allToDelete.length > 0) {
        for (let i = 0; i < allToDelete.length; i += 1000) {
          const batch = allToDelete.slice(i, i + 1000);
          await client.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: {
                Objects: batch,
                Quiet: true,
              },
            })
          );
        }
      }
    } catch {
      // Best effort version deletion
    }

    // Fallback/standard delete for all keys
    for (let i = 0; i < uniqueKeys.length; i += 1000) {
      const batch = uniqueKeys.slice(i, i + 1000);
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
        },
      });

      await client.send(command);
    }
  }

  async listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult> {
    const client = this.ensureConfigured();
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: options?.prefix,
      MaxKeys: options?.maxKeys,
      ContinuationToken: options?.continuationToken,
    });

    const response = await client.send(command);
    const objects: S3ObjectSummary[] = (response.Contents ?? [])
      .map((item) => ({
        key: item.Key ?? "",
        size: item.Size ?? 0,
        lastModified: item.LastModified ?? new Date(),
        eTag: item.ETag,
      }))
      .filter((item) => Boolean(item.key));

    return {
      objects,
      isTruncated: Boolean(response.IsTruncated),
      nextContinuationToken: response.NextContinuationToken,
    };
  }

  async listAllObjects(prefix?: string): Promise<S3ObjectSummary[]> {
    const allObjects: S3ObjectSummary[] = [];
    let continuationToken: string | undefined = undefined;

    do {
      const result = await this.listObjects({
        prefix,
        continuationToken,
      });
      allObjects.push(...result.objects);
      continuationToken = result.isTruncated ? result.nextContinuationToken : undefined;
    } while (continuationToken);

    return allObjects;
  }

  async purgeDanglingVersions(prefix?: string): Promise<PurgeDanglingResult> {
    const client = this.ensureConfigured();

    // 1. Get all active/live object keys in the bucket (or under prefix)
    const activeObjects = await this.listAllObjects(prefix);
    const activeKeys = new Set(activeObjects.map((o) => o.key));

    // 2. Paginate over all object versions and delete markers
    let keyMarker: string | undefined = undefined;
    let versionIdMarker: string | undefined = undefined;
    const toDelete: Array<{ Key: string; VersionId?: string }> = [];
    let purgedVersionsCount = 0;
    let purgedDeleteMarkersCount = 0;

    do {
      const versionsRes: ListObjectVersionsCommandOutput = await client.send(
        new ListObjectVersionsCommand({
          Bucket: this.bucket,
          Prefix: prefix,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
        })
      );

      for (const v of versionsRes.Versions ?? []) {
        if (v.Key && !activeKeys.has(v.Key)) {
          toDelete.push({ Key: v.Key, VersionId: v.VersionId });
          purgedVersionsCount++;
        }
      }

      for (const dm of versionsRes.DeleteMarkers ?? []) {
        if (dm.Key && !activeKeys.has(dm.Key)) {
          toDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
          purgedDeleteMarkersCount++;
        }
      }

      if (versionsRes.IsTruncated) {
        keyMarker = versionsRes.NextKeyMarker;
        versionIdMarker = versionsRes.NextVersionIdMarker;
      } else {
        keyMarker = undefined;
        versionIdMarker = undefined;
      }
    } while (keyMarker || versionIdMarker);

    // 3. Batch delete dangling versions and markers
    if (toDelete.length > 0) {
      for (let i = 0; i < toDelete.length; i += 1000) {
        const batch = toDelete.slice(i, i + 1000);
        await client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: batch,
              Quiet: true,
            },
          })
        );
      }
    }

    return {
      purgedVersionsCount,
      purgedDeleteMarkersCount,
    };
  }

  async abortStaleMultipartUploads(
    options?: AbortStaleMultipartUploadsOptions
  ): Promise<AbortStaleMultipartUploadsResult> {
    const client = this.ensureConfigured();
    const maxAgeSeconds = options?.maxAgeSeconds ?? 86400; // default 24 hours
    const cutoffTime = Date.now() - maxAgeSeconds * 1000;

    let keyMarker: string | undefined = undefined;
    let uploadIdMarker: string | undefined = undefined;
    let abortedUploadsCount = 0;

    do {
      const response: ListMultipartUploadsCommandOutput = await client.send(
        new ListMultipartUploadsCommand({
          Bucket: this.bucket,
          Prefix: options?.prefix,
          KeyMarker: keyMarker,
          UploadIdMarker: uploadIdMarker,
        })
      );

      for (const upload of response.Uploads ?? []) {
        if (!upload.Key || !upload.UploadId) continue;
        const initiatedTime = upload.Initiated ? new Date(upload.Initiated).getTime() : 0;
        if (initiatedTime <= cutoffTime) {
          try {
            await client.send(
              new AbortMultipartUploadCommand({
                Bucket: this.bucket,
                Key: upload.Key,
                UploadId: upload.UploadId,
              })
            );
            abortedUploadsCount++;
          } catch {
            // Best effort abort per upload
          }
        }
      }

      if (response.IsTruncated) {
        keyMarker = response.NextKeyMarker;
        uploadIdMarker = response.NextUploadIdMarker;
      } else {
        keyMarker = undefined;
        uploadIdMarker = undefined;
      }
    } while (keyMarker || uploadIdMarker);

    return {
      abortedUploadsCount,
    };
  }

  async getBucketStorageUsage(): Promise<BucketStorageUsage> {
    const objects = await this.listAllObjects();
    const totalSizeBytes = objects.reduce((sum, obj) => sum + (obj.size || 0), 0);
    return {
      totalSizeBytes,
      objectCount: objects.length,
    };
  }
}

export function createS3StorageService(
  options?: S3StorageServiceOptions
): S3StorageService {
  return new DefaultS3StorageService(options);
}
