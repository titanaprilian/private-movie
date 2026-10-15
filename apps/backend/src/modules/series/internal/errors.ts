export class SeriesNotFoundError extends Error {
  constructor(message = "Series not found") {
    super(message);
    this.name = "SeriesNotFoundError";
  }
}

export class SeriesHighlightWithoutOngoingError extends Error {
  constructor(message = "Cannot highlight a series with no ongoing seasons") {
    super(message);
    this.name = "SeriesHighlightWithoutOngoingError";
  }
}
