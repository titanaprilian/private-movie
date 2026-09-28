import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";

export const MINIO_DEFAULT_BUCKET = "private-movie-videos";
export const MINIO_DEFAULT_REGION = "us-east-1";

export const MINIO_VIDEO_CORS_RULE = {
  AllowedHeaders: ["*"],
  AllowedMethods: ["GET", "HEAD"],
  AllowedOrigins: ["*"],
  ExposeHeaders: ["Content-Range", "Content-Length", "ETag", "Accept-Ranges"],
  MaxAgeSeconds: 3600,
};

export interface EnsureMinioBucketInput {
  endpoint: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

/**
 * Detect MinIO/AWS SDK CORS "not implemented" failures. Recent AWS SDK JS v3
 * releases inject `x-amz-sdk-checksum-algorithm: CRC32` on
 * `PutBucketCorsCommand`, which MinIO rejects with `501 NotImplemented` on
 * bucket subresource endpoints. MinIO natively serves CORS headers for all
 * object requests, so this failure is safe to ignore.
 */
export function isBucketCorsNotImplementedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "NotImplemented") return true;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  if (status === 501) return true;
  // Fall back to message matching for untyped / wrapped SDK errors.
  return /notimplemented|\b501\b/i.test(error.message);
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `http://${trimmed}`;
}

/**
 * Ensure the target bucket exists on the MinIO instance and apply the
 * permissive CORS policy required for HTML5 video range streaming.
 * Idempotent: existing buckets are left untouched apart from the CORS update.
 */
export async function ensureMinioBucketWithCors(input: EnsureMinioBucketInput): Promise<void> {
  const region = input.region?.trim() || MINIO_DEFAULT_REGION;
  const client = new S3Client({
    endpoint: normalizeEndpoint(input.endpoint),
    region,
    forcePathStyle: input.forcePathStyle ?? true,
    credentials: {
      accessKeyId: input.accessKeyId,
      secretAccessKey: input.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: input.bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: input.bucket }));
  }

  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: input.bucket,
        CORSConfiguration: { CORSRules: [MINIO_VIDEO_CORS_RULE] },
      })
    );
  } catch (error) {
    if (isBucketCorsNotImplementedError(error)) {
      // MinIO serves CORS natively (Access-Control-Allow-Origin,
      // Access-Control-Expose-Headers, Range support) for all object
      // requests, so a rejected PutBucketCors is informational only.
      // eslint-disable-next-line no-console
      console.info(
        `MinIO bucket "${input.bucket}" does not support PutBucketCors (NotImplemented/501); relying on MinIO native CORS handling.`
      );
      return;
    }
    throw error;
  }
}
