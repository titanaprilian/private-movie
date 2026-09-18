export class InternalServerError extends Error {
  constructor() {
    super("internal server error");
  }
}

export class FileTooLargeError extends Error {
  constructor(message = "File size exceeds the maximum allowed limit of 1GB") {
    super(message);
    this.name = "FileTooLargeError";
  }
}

export class UploadSessionNotFoundError extends Error {
  constructor(message = "Upload session not found") {
    super(message);
    this.name = "UploadSessionNotFoundError";
  }
}

export function getDomainErrorStatus(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const name = error.name || error.constructor?.name || "";

  if (name.endsWith("NotFoundError")) return 404;

  if (
    name === "GenreAlreadyExistsError" ||
    name === "EmailAlreadyRegisteredError" ||
    name === "StorageProviderInUseError" ||
    name === "SeasonNotEmptyError" ||
    name.endsWith("AlreadyExistsError") ||
    name === "ConflictError"
  ) {
    return 409;
  }

  if (name === "UnauthorizedError" || name === "InvalidCredentialsError") return 401;

  if (name === "AccountLockedError") return 429;

  if (name === "FileTooLargeError") return 413;

  if (name === "S3NotConfiguredError") return 503;

  if (name === "TmdbFetchError") {
    const status = (error as { status?: number }).status;
    return status === 404 ? 404 : 400;
  }

  if (
    name === "InvalidRegistrationInputError" ||
    name === "SeasonNotOngoingError" ||
    name === "SeasonMissingScraperUrlError" ||
    name === "EpisodeParseError" ||
    name === "EpisodeFetchError" ||
    name === "MirrorResolveError" ||
    name === "SeriesParseError" ||
    name === "SeriesFetchError" ||
    name === "EpisodeMissingFieldsError"
  ) {
    return 400;
  }

  return null;
}

