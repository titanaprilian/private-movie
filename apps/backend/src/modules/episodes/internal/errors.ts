export {
  EpisodeNotFoundError,
  VideoSourceNotFoundError,
} from "@repo/media-service";

export class ArchivePasswordRequiredError extends Error {
  constructor(
    message = "Archive is password-protected; a password is required",
  ) {
    super(message);
    this.name = "ArchivePasswordRequiredError";
  }
}

export class InvalidArchivePasswordError extends Error {
  constructor(message = "Archive password is incorrect") {
    super(message);
    this.name = "InvalidArchivePasswordError";
  }
}

export class ArchiveExtractionError extends Error {
  constructor(message = "Failed to extract archive") {
    super(message);
    this.name = "ArchiveExtractionError";
  }
}
