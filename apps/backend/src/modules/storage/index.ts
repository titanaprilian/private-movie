export { createStorageService } from "./internal/services/service";

export {
  EpisodeNotFoundError,
  VideoSourceNotFoundError,
  StorageProviderNotFoundError,
  StorageProviderInUseError,
  MinioCredentialsRejectedError,
  MinioDockerUnavailableError,
  MinioHealthTimeoutError,
} from "./internal/errors";

export type {
  StorageService,
  StorageServiceOptions,
  StorageOverrides,
  MinioDeps,
  MinioBucketProvisioner,
  MinioBucketProvisionerInput,
  MinioContainerInspector,
  MinioContainerState,
  MinioContainerStarter,
  MinioHealthChecker,
} from "./internal/types";

export { startMinioContainerViaDockerSocket } from "./internal/services/minio-orchestrator";
