import { describe, expect, it } from "vitest";
import { errorResponse, successResponse } from "@/lib/response";

class InternalServerError extends Error {}
class EmailAlreadyRegisteredError extends Error {}
class InvalidRegistrationInputError extends Error {}
class InvalidCredentialsError extends Error {}
class AccountLockedError extends Error {}
class UnauthorizedError extends Error {}
class UserNotFoundError extends Error {}
class Foo extends Error {}
class HTTPServerError extends Error {}

describe("response helpers", () => {
  it("returns { data } envelope from successResponse", () => {
    expect(successResponse({ id: 1 })).toEqual({ data: { id: 1 } });
  });

  it("sets status and returns { error: { code, message } } from errorResponse", () => {
    const set = { status: 0 };
    const error = new Error("something went wrong");
    const response = errorResponse(set, 400, error);

    expect(set.status).toBe(400);
    expect(response).toEqual({
      error: {
        code: "",
        message: "something went wrong",
      },
    });
  });

  it("derives INTERNAL_SERVER from InternalServerError", () => {
    const set = { status: 0 };
    const response = errorResponse(set, 500, new InternalServerError("boom"));

    expect(response.error.code).toBe("INTERNAL_SERVER");
  });

  it("derives EMAIL_ALREADY_REGISTERED from EmailAlreadyRegisteredError", () => {
    const set = { status: 0 };
    const response = errorResponse(
      set,
      409,
      new EmailAlreadyRegisteredError("already registered")
    );

    expect(response.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("derives INVALID_REGISTRATION_INPUT from InvalidRegistrationInputError", () => {
    const set = { status: 0 };
    const response = errorResponse(
      set,
      400,
      new InvalidRegistrationInputError("bad input")
    );

    expect(response.error.code).toBe("INVALID_REGISTRATION_INPUT");
  });

  it("derives INVALID_CREDENTIALS from InvalidCredentialsError", () => {
    const set = { status: 0 };
    const response = errorResponse(
      set,
      401,
      new InvalidCredentialsError("nope")
    );

    expect(response.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("derives ACCOUNT_LOCKED from AccountLockedError", () => {
    const set = { status: 0 };
    const response = errorResponse(
      set,
      429,
      new AccountLockedError("locked")
    );

    expect(response.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("derives UNAUTHORIZED from UnauthorizedError", () => {
    const set = { status: 0 };
    const response = errorResponse(set, 401, new UnauthorizedError("no"));

    expect(response.error.code).toBe("UNAUTHORIZED");
  });

  it("derives USER_NOT_FOUND from UserNotFoundError", () => {
    const set = { status: 0 };
    const response = errorResponse(set, 404, new UserNotFoundError("gone"));

    expect(response.error.code).toBe("USER_NOT_FOUND");
  });

  it("derives empty code from plain Error (known behavior)", () => {
    const set = { status: 0 };
    const response = errorResponse(set, 500, new Error("plain"));

    expect(response.error.code).toBe("");
  });

  it("derives FOO from custom class without Error suffix (known behavior)", () => {
    const set = { status: 0 };
    const response = errorResponse(set, 500, new Foo("foo"));

    expect(response.error.code).toBe("FOO");
  });

  it("derives HTTPSERVER for consecutive uppercase letters (known behavior)", () => {
    const set = { status: 0 };
    const response = errorResponse(set, 500, new HTTPServerError("bad"));

    expect(response.error.code).toBe("HTTPSERVER");
  });
});
