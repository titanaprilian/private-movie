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

