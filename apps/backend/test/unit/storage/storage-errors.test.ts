import { describe, expect, it } from "vitest";
import {
  EpisodeNotFoundError,
  MinioCredentialsRejectedError,
  MinioDockerUnavailableError,
  MinioHealthTimeoutError,
  StorageProviderInUseError,
  StorageProviderNotFoundError,
  VideoSourceNotFoundError,
} from "@/modules/storage/internal/errors";

describe("storage error classes", () => {
  it("instantiates EpisodeNotFoundError with default and custom messages", () => {
    const defaultErr = new EpisodeNotFoundError();
    expect(defaultErr.message).toBe("Episode not found");
    expect(defaultErr.name).toBe("EpisodeNotFoundError");

    const customErr = new EpisodeNotFoundError("Custom episode not found");
    expect(customErr.message).toBe("Custom episode not found");
  });

  it("instantiates VideoSourceNotFoundError with default and custom messages", () => {
    const defaultErr = new VideoSourceNotFoundError();
    expect(defaultErr.message).toBe("Video source not found");
    expect(defaultErr.name).toBe("VideoSourceNotFoundError");

    const customErr = new VideoSourceNotFoundError("Custom source error");
    expect(customErr.message).toBe("Custom source error");
  });

  it("instantiates StorageProviderNotFoundError with default and custom messages", () => {
    const defaultErr = new StorageProviderNotFoundError();
    expect(defaultErr.message).toBe("Storage provider not found");
    expect(defaultErr.name).toBe("StorageProviderNotFoundError");

    const customErr = new StorageProviderNotFoundError("Provider missing");
    expect(customErr.message).toBe("Provider missing");
  });

  it("instantiates StorageProviderInUseError with default and custom messages", () => {
    const defaultErr = new StorageProviderInUseError();
    expect(defaultErr.message).toBe(
      "Cannot delete storage provider with active video sources",
    );
    expect(defaultErr.name).toBe("StorageProviderInUseError");

    const customErr = new StorageProviderInUseError("In use");
    expect(customErr.message).toBe("In use");
  });

  it("instantiates MinioDockerUnavailableError with default and custom messages", () => {
    const defaultErr = new MinioDockerUnavailableError();
    expect(defaultErr.message).toContain("Docker daemon is not accessible");
    expect(defaultErr.name).toBe("MinioDockerUnavailableError");

    const customErr = new MinioDockerUnavailableError("Docker socket error");
    expect(customErr.message).toBe("Docker socket error");
  });

  it("instantiates MinioHealthTimeoutError with default and custom messages", () => {
    const defaultErr = new MinioHealthTimeoutError();
    expect(defaultErr.message).toContain(
      "MinIO container did not become healthy in time",
    );
    expect(defaultErr.name).toBe("MinioHealthTimeoutError");

    const customErr = new MinioHealthTimeoutError("Health timed out");
    expect(customErr.message).toBe("Health timed out");
  });

  it("instantiates MinioCredentialsRejectedError with default and custom messages", () => {
    const defaultErr = new MinioCredentialsRejectedError();
    expect(defaultErr.message).toContain(
      "MinIO rejected all known credential candidates",
    );
    expect(defaultErr.name).toBe("MinioCredentialsRejectedError");

    const customErr = new MinioCredentialsRejectedError("Bad credentials");
    expect(customErr.message).toBe("Bad credentials");
  });
});
