export class SeriesParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesParseError";
  }
}

export class EpisodeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EpisodeParseError";
  }
}

export class EpisodeMissingFieldsError extends EpisodeParseError {
  missingFields: string[];

  constructor(missingFields: string[]) {
    super(`Missing episode fields: ${missingFields.join(", ")}`);
    this.name = "EpisodeMissingFieldsError";
    this.missingFields = missingFields;
  }
}

export class MirrorResolveError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "MirrorResolveError";
  }
}
