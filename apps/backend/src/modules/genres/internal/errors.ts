export class GenreNotFoundError extends Error {
  constructor(message = "Genre not found") {
    super(message);
    this.name = "GenreNotFoundError";
  }
}

export class GenreAlreadyExistsError extends Error {
  constructor(message = "Genre with this name or slug already exists") {
    super(message);
    this.name = "GenreAlreadyExistsError";
  }
}
