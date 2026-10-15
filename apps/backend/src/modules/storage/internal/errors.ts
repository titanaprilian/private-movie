export class EpisodeNotFoundError extends Error {
  constructor(message = "Episode not found") {
    super(message);
    this.name = "EpisodeNotFoundError";
  }
}

export class VideoSourceNotFoundError extends Error {
  constructor(message = "Video source not found") {
    super(message);
    this.name = "VideoSourceNotFoundError";
  }
}

export class StorageProviderNotFoundError extends Error {
  constructor(message = "Storage provider not found") {
    super(message);
    this.name = "StorageProviderNotFoundError";
  }
}

export class StorageProviderInUseError extends Error {
  constructor(
    message = "Cannot delete storage provider with active video sources",
  ) {
    super(message);
    this.name = "StorageProviderInUseError";
  }
}

export class MinioDockerUnavailableError extends Error {
  constructor(
    message = "Docker daemon is not accessible. Ensure /var/run/docker.sock is mounted into the backend container.",
  ) {
    super(message);
    this.name = "MinioDockerUnavailableError";
  }
}

export class MinioHealthTimeoutError extends Error {
  constructor(
    message = "MinIO container did not become healthy in time. Check container logs and port availability.",
  ) {
    super(message);
    this.name = "MinioHealthTimeoutError";
  }
}

export class MinioCredentialsRejectedError extends Error {
  constructor(
    message = "MinIO rejected all known credential candidates. The server was initialized with different root credentials — set MINIO_ROOT_USER/MINIO_ROOT_PASSWORD to match, or reset the minio_data volume for a fresh start.",
  ) {
    super(message);
    this.name = "MinioCredentialsRejectedError";
  }
}
