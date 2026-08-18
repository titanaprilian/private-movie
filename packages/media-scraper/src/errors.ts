export class SeriesParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesParseError";
  }
}
