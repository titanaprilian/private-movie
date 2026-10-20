import { t } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import type {
  S3StorageService,
  StorageProviderRegistry,
} from "@repo/media-service";
import type { StorageOverrides, StorageService } from "./internal/types";

const storageTag = "Storage";

export interface StorageRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  storageService?: StorageService;
  overrides?: StorageOverrides;
}

export const providerIdParams = t.Object({
  id: t.String({ minLength: 1 }),
});

export const createProviderBody = t.Object({
  name: t.String({ minLength: 1 }),
  providerType: t.String({ minLength: 1 }),
  endpoint: t.String({ minLength: 1 }),
  region: t.String({ minLength: 1 }),
  bucket: t.String({ minLength: 1 }),
  accessKeyId: t.String({ minLength: 1 }),
  secretAccessKey: t.String({ minLength: 1 }),
  publicBaseUrl: t.Optional(t.Nullable(t.String())),
  forcePathStyle: t.Optional(t.Boolean()),
  storageLimitGb: t.Optional(t.Number()),
  isDefault: t.Optional(t.Boolean()),
  isEnabled: t.Optional(t.Boolean()),
});

export const updateProviderBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  providerType: t.Optional(t.String({ minLength: 1 })),
  endpoint: t.Optional(t.String({ minLength: 1 })),
  region: t.Optional(t.String({ minLength: 1 })),
  bucket: t.Optional(t.String({ minLength: 1 })),
  accessKeyId: t.Optional(t.String()),
  secretAccessKey: t.Optional(t.String()),
  publicBaseUrl: t.Optional(t.Nullable(t.String())),
  forcePathStyle: t.Optional(t.Boolean()),
  storageLimitGb: t.Optional(t.Number()),
  isDefault: t.Optional(t.Boolean()),
  isEnabled: t.Optional(t.Boolean()),
});

export const testProviderBody = t.Optional(
  t.Object({
    providerId: t.Optional(t.String()),
    endpoint: t.Optional(t.String()),
    region: t.Optional(t.String()),
    bucket: t.Optional(t.String()),
    accessKeyId: t.Optional(t.String()),
    secretAccessKey: t.Optional(t.String()),
    forcePathStyle: t.Optional(t.Boolean()),
  }),
);

export const spinUpMinioBody = t.Optional(
  t.Object({
    endpoint: t.Optional(t.String()),
    port: t.Optional(t.Number()),
    consolePort: t.Optional(t.Number()),
    bucket: t.Optional(t.String()),
    accessKeyId: t.Optional(t.String()),
    secretAccessKey: t.Optional(t.String()),
    isDefault: t.Optional(t.Boolean()),
  }),
);

export const metricsQuery = t.Optional(
  t.Object({
    providerId: t.Optional(t.String()),
  }),
);

export const resourcesQuery = t.Optional(
  t.Object({
    providerId: t.Optional(t.String()),
    seriesId: t.Optional(t.String()),
    seasonId: t.Optional(t.String()),
    status: t.Optional(t.String()),
    search: t.Optional(t.String()),
    sortBy: t.Optional(t.String()),
    sortOrder: t.Optional(t.String()),
    page: t.Optional(t.String()),
    limit: t.Optional(t.String()),
  }),
);

export const seriesQuery = t.Optional(
  t.Object({
    providerId: t.Optional(t.String()),
  }),
);

export const scanBody = t.Optional(
  t.Object({
    providerId: t.Optional(t.String()),
  }),
);

export const updateLimitBody = t.Object({
  limitGb: t.Number(),
  providerId: t.Optional(t.String()),
});

export const resourceIdParams = t.Object({
  id: t.String(),
});

export const updateResourceMetadataBody = t.Object({
  label: t.Optional(t.String({ minLength: 1 })),
  quality: t.Optional(t.Nullable(t.String())),
});

export const attachOrphanBody = t.Object({
  key: t.String({ minLength: 1 }),
  episodeId: t.String({ minLength: 1 }),
  label: t.Optional(t.String()),
  quality: t.Optional(t.Nullable(t.String())),
  providerId: t.Optional(t.String()),
});

export const deleteResourcesBody = t.Object({
  keys: t.Array(t.String({ minLength: 1 })),
  providerId: t.Optional(t.String()),
});

export const purgeOrphansBody = t.Optional(
  t.Object({
    providerId: t.Optional(t.String()),
  }),
);

export const previewUrlQuery = t.Object({
  key: t.String({ minLength: 1 }),
  providerId: t.Optional(t.String()),
});

export const listProvidersDetail = {
  tags: [storageTag],
  summary: "List storage providers",
  description: "Returns all configured storage providers.",
};

export const getProviderDetail = {
  tags: [storageTag],
  summary: "Get storage provider",
  description: "Returns a single storage provider by id.",
};

export const createProviderDetail = {
  tags: [storageTag],
  summary: "Create storage provider",
  description: "Creates a new storage provider configuration.",
};

export const updateProviderDetail = {
  tags: [storageTag],
  summary: "Update storage provider",
  description: "Updates an existing storage provider by id.",
};

export const deleteProviderDetail = {
  tags: [storageTag],
  summary: "Delete storage provider",
  description: "Deletes a storage provider by id.",
};

export const testProviderDetail = {
  tags: [storageTag],
  summary: "Test storage provider connection",
  description:
    "Tests connectivity and credentials for a storage provider configuration.",
};

export const minioStatusDetail = {
  tags: [storageTag],
  summary: "Get MinIO status",
  description: "Returns the current MinIO container status.",
};

export const spinUpMinioDetail = {
  tags: [storageTag],
  summary: "Spin up MinIO",
  description: "Provisions and starts a local MinIO container.",
};

export const metricsDetail = {
  tags: [storageTag],
  summary: "Get storage metrics",
  description:
    "Returns aggregated storage usage metrics, optionally scoped to a provider.",
};

export const resourcesDetail = {
  tags: [storageTag],
  summary: "List storage resources",
  description: "Lists stored objects with filtering, sorting, and pagination.",
};

export const seriesDetail = {
  tags: [storageTag],
  summary: "List storage series",
  description:
    "Lists series with aggregated S3 video file counts, byte totals, and season breakdowns.",
};

export const scanDetail = {
  tags: [storageTag],
  summary: "Trigger storage scan",
  description:
    "Triggers a scan of stored objects to reconcile the resource index.",
};

export const updateLimitDetail = {
  tags: [storageTag],
  summary: "Update storage limit",
  description:
    "Updates the storage quota limit, optionally scoped to a provider.",
};

export const updateResourceMetadataDetail = {
  tags: [storageTag],
  summary: "Update resource metadata",
  description: "Updates label and quality metadata for a storage resource.",
};

export const attachOrphanDetail = {
  tags: [storageTag],
  summary: "Attach orphan resource",
  description: "Attaches an orphaned stored object to an episode.",
};

export const deleteResourcesDetail = {
  tags: [storageTag],
  summary: "Delete resources",
  description: "Deletes stored objects by key.",
};

export const purgeOrphansDetail = {
  tags: [storageTag],
  summary: "Purge orphans",
  description: "Permanently removes orphaned stored objects.",
};

export const previewUrlDetail = {
  tags: [storageTag],
  summary: "Get preview URL",
  description: "Returns a signed preview URL for a stored object.",
};
