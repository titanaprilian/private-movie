import { type Readable } from "node:stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
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
}

export interface StreamUploadOptions {
  contentType?: string;
  onProgress?: (progress: { loaded: number; total?: number }) => void;
  signal?: AbortSignal;
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

    if (endpoint && bucket && accessKeyId && secretAccessKey) {
      this.configured = true;
      this.client = new S3Client({
        endpoint,
        region,
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

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await client.send(command);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    const client = this.ensureConfigured();
    if (!keys || keys.length === 0) return;

    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
      },
    });

    await client.send(command);
  }
}

export function createS3StorageService(
  options?: S3StorageServiceOptions
): S3StorageService {
  return new DefaultS3StorageService(options);
}
