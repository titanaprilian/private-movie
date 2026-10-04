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
import type { ArchiveExtractFn, ArchiveFetchFn } from "./modules/series";
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
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  archiveFetchFn?: ArchiveFetchFn;
  archiveExtractFn?: ArchiveExtractFn;
  archiveStagingBaseDir?: string;
  scheduler?: SchedulerDeps;
  storage?: StorageOverrides;
  rateLimit?: RateLimitPluginOptions;
  authRateLimit?: AuthRateLimitOptions;
}

export interface CreateAppDeps {
  db: DbClient;
  auth: AuthenticationService;
  storageService: StorageService;
  overrides?: CreateAppOverrides;
}
