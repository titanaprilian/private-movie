import { randomUUID } from "node:crypto";
import {
  encryptCredential,
  decryptCredential,
  ensureMinioBucketWithCors,
  MINIO_DEFAULT_BUCKET,
} from "@repo/media-service";
import type {
  MinioStatusResponseData,
  MinioSpinUpRequest,
  MinioSpinUpResponseData,
} from "@repo/contracts";
import type { StorageProviderRow } from "@repo/db";
import {
  buildMinioStatusResponse,
  createDefaultMinioInspector,
  MINIO_CONTAINER_NAME,
} from "./minio-status";
import {
  isS3AuthError,
  MINIO_DEFAULT_ROOT_PASSWORD,
  MINIO_DEFAULT_ROOT_USER,
  resolveMinioAccessKey,
  resolveMinioConsoleUrlFromInput,
  resolveMinioEndpoint,
  resolveMinioSecretKey,
  startMinioContainerViaDockerSocket,
  waitForMinioHealthy,
  type MinioContainerStarter,
  type MinioHealthChecker,
} from "./minio-orchestrator";
import { MinioCredentialsRejectedError } from "../errors";
import type { StorageRepository } from "../repositories/repository";
import type { StorageServiceOptions, MinioBucketProvisioner } from "../types";
import { DEFAULT_LIMIT_GB, formatProviderItem } from "./provider-formatter";

export interface MinioServiceDependencies {
  repository: StorageRepository;
  invalidateCache: (providerId?: string) => void;
  options?: StorageServiceOptions;
}

export class MinioService {
  private minioInspector: () => Promise<
    ReturnType<typeof createDefaultMinioInspector> extends () => Promise<
      infer R
    >
      ? R
      : never
  >;
  private minioContainerStarter: MinioContainerStarter;
  private minioHealthChecker: MinioHealthChecker;
  private minioBucketProvisioner: MinioBucketProvisioner;

  constructor(private deps: MinioServiceDependencies) {
    this.minioInspector =
      deps.options?.minioInspector ?? createDefaultMinioInspector();
    this.minioContainerStarter =
      deps.options?.minioContainerStarter ??
      ((containerName = MINIO_CONTAINER_NAME) =>
        startMinioContainerViaDockerSocket(containerName));
    this.minioHealthChecker =
      deps.options?.minioHealthChecker ??
      ((endpoint) => waitForMinioHealthy(endpoint));
    this.minioBucketProvisioner =
      deps.options?.minioBucketProvisioner ?? ensureMinioBucketWithCors;
  }

  async getMinioStatus(): Promise<MinioStatusResponseData> {
    const container = await this.minioInspector();
    const rows = await this.deps.repository.listMinioProviders();
    const provider =
      rows.find((r) => r.isDefault && r.isEnabled) ??
      rows.find((r) => r.isEnabled) ??
      rows[0] ??
      null;
    return buildMinioStatusResponse(container, provider);
  }

  async spinUpMinio(
    input: MinioSpinUpRequest,
  ): Promise<MinioSpinUpResponseData> {
    const endpoint = resolveMinioEndpoint(input);
    const bucket = input.bucket?.trim() || MINIO_DEFAULT_BUCKET;
    const region = "us-east-1";
    const consoleUrl = resolveMinioConsoleUrlFromInput(input);

    const container = await this.minioInspector();
    if (!container.isRunning) {
      await this.minioContainerStarter();
    }

    await this.minioHealthChecker(endpoint);

    const match = await this.deps.repository.findMinioProvider(
      endpoint,
      bucket,
    );

    const candidates: { accessKeyId: string; secretAccessKey: string }[] = [
      {
        accessKeyId: resolveMinioAccessKey(input.accessKeyId),
        secretAccessKey: resolveMinioSecretKey(input.secretAccessKey),
      },
    ];
    if (match) {
      try {
        candidates.push({
          accessKeyId: decryptCredential(match.accessKeyIdEnc),
          secretAccessKey: decryptCredential(match.secretAccessKeyEnc),
        });
      } catch {
        // Corrupt stored ciphertext — fall through to remaining candidates.
      }
    }
    candidates.push({
      accessKeyId:
        process.env.MINIO_ROOT_USER?.trim() ||
        process.env.MINIO_ACCESS_KEY?.trim() ||
        MINIO_DEFAULT_ROOT_USER,
      secretAccessKey:
        process.env.MINIO_ROOT_PASSWORD?.trim() ||
        process.env.MINIO_SECRET_KEY?.trim() ||
        MINIO_DEFAULT_ROOT_PASSWORD,
    });

    const seen = new Set<string>();
    let workingCreds: {
      accessKeyId: string;
      secretAccessKey: string;
    } | null = null;
    for (const candidate of candidates) {
      const key = `${candidate.accessKeyId}\n${candidate.secretAccessKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        await this.minioBucketProvisioner({
          endpoint,
          region,
          bucket,
          accessKeyId: candidate.accessKeyId,
          secretAccessKey: candidate.secretAccessKey,
          forcePathStyle: true,
        });
        workingCreds = candidate;
        break;
      } catch (err) {
        if (!isS3AuthError(err)) throw err;
      }
    }
    if (!workingCreds) {
      throw new MinioCredentialsRejectedError();
    }
    const { accessKeyId, secretAccessKey } = workingCreds;

    const now = new Date();
    if (input.isDefault) {
      await this.deps.repository.unsetDefaultProviders();
    }

    const accessKeyIdEnc = encryptCredential(accessKeyId);
    const secretAccessKeyEnc = encryptCredential(secretAccessKey);

    let row: StorageProviderRow;
    if (match) {
      const updated = await this.deps.repository.updateProvider(match.id, {
        endpoint,
        region,
        bucket,
        accessKeyIdEnc,
        secretAccessKeyEnc,
        forcePathStyle: true,
        isEnabled: true,
        ...(input.isDefault !== undefined
          ? { isDefault: input.isDefault }
          : {}),
        updatedAt: now,
      });
      row = updated!;
    } else {
      row = await this.deps.repository.insertProvider({
        id: randomUUID(),
        name: "Local MinIO",
        providerType: "minio",
        endpoint,
        region,
        bucket,
        accessKeyIdEnc,
        secretAccessKeyEnc,
        publicBaseUrl: null,
        forcePathStyle: true,
        storageLimitGb: DEFAULT_LIMIT_GB,
        isDefault: input.isDefault ?? false,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    this.deps.invalidateCache(row.id);
    const provider = formatProviderItem(row, 0);
    return { provider, consoleUrl, accessKeyId, secretAccessKey };
  }
}
