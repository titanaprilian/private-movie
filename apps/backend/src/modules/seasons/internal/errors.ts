export class SeasonNotFoundError extends Error {
  constructor(message = "Season not found") {
    super(message);
    this.name = "SeasonNotFoundError";
  }
}

export class SeasonNotOngoingError extends Error {
  constructor(message = "Season is not in ongoing status") {
    super(message);
    this.name = "SeasonNotOngoingError";
  }
}

export class SeasonMissingScraperUrlError extends Error {
  constructor(message = "Season is missing scraperUrl or source") {
    super(message);
    this.name = "SeasonMissingScraperUrlError";
  }
}

export class SeasonNotEmptyError extends Error {
  readonly episodeCount: number;
  constructor(episodeCount: number) {
    super(`Season still contains ${episodeCount} episode(s) and cannot be deleted`);
    this.name = "SeasonNotEmptyError";
    this.episodeCount = episodeCount;
  }
}

export class SeasonAlreadyExistsError extends Error {
  constructor(message = "Season number already exists for this series") {
    super(message);
    this.name = "SeasonAlreadyExistsError";
  }
}
