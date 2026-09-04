import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3StorageServiceOptions {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  presignedGetExpiresIn?: number;
}

export interface S3StorageService {
  isConfigured(): boolean;
  getPresignedUploadUrl(key: string, contentType?: string): Promise<{ uploadUrl: string; key: string }>;
  getPresignedPlaybackUrl(key: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
}

export class S3NotConfiguredError extends Error {
  constructor(message = "S3 storage service is not configured") {
    super(message);
    this.name = "S3NotConfiguredError";
  }
}

class DefaultS3StorageService implements S3StorageService {
  private readonly client: S3Client | null = null;
  private readonly bucket: string;
  private readonly defaultExpiresIn: number;
  private readonly configured: boolean;

  constructor(options?: S3StorageServiceOptions) {
    const endpoint = (options?.endpoint ?? process.env.S3_ENDPOINT ?? "").trim();
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

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
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
