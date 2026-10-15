import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import type {
  BrowserFn,
  FetchFn,
  S3StorageService,
  StorageProviderRegistry,
} from "@repo/media-service";
import type { AuthRateLimitOptions } from "./modules/authentication/http";
import type { OngoingSeasonScheduler } from "./modules/media/scheduler";
import type { RateLimitPluginOptions } from "./plugins";
import type { ArchiveFetchFn, ArchiveIngestJobService } from "./modules/series";
import type {
  StorageOverrides,
  StorageService,
} from "./modules/storage";

export type SchedulerDeps = Pick<
  OngoingSeasonScheduler,
  | "runNow"
  | "isEnabled"
  | "isExecuting"
  | "getIntervalMs"
  | "getLastRunAt"
  | "getLastRunResult"
  | "getNextRunAt"
  | "setEnabled"
  | "updateInterval"
>;

export type StorageUsageProvider = Pick<StorageService, "getTotalUsedBytes">;

export interface CreateAppOverrides {
  fetchHtml?: FetchFn;
  archiveFetchFn?: ArchiveFetchFn;
  storageUsageProvider?: StorageUsageProvider;
  storage?: StorageOverrides;
  rateLimit?: RateLimitPluginOptions;
  authRateLimit?: AuthRateLimitOptions;
}

export interface CreateAppDeps {
  db: DbClient;
  auth: AuthenticationService;
  storageService: StorageService;
  storageProviderRegistry: StorageProviderRegistry;
  browserFn: BrowserFn;
  s3StorageService?: S3StorageService;
  scheduler?: SchedulerDeps;
  archiveJobService?: ArchiveIngestJobService;
  archiveStagingBaseDir?: string;
  overrides?: CreateAppOverrides;
}
