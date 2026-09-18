import { describe, expect, it, afterEach } from "vitest";
import { validateJwtSecret } from "../../../src/modules/authentication";

describe("validateJwtSecret in production", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalSecret;
  });

  it("throws error in production mode when JWT_SECRET is unset or empty", () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;

    expect(() => validateJwtSecret()).toThrow("FATAL: Insecure or missing JWT_SECRET in production environment");

    process.env.JWT_SECRET = "   ";
    expect(() => validateJwtSecret()).toThrow("FATAL: Insecure or missing JWT_SECRET in production environment");
  });

  it("throws error in production mode when JWT_SECRET is an insecure placeholder", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "default-jwt-secret-key-change-in-production";

    expect(() => validateJwtSecret()).toThrow("FATAL: Insecure or missing JWT_SECRET in production environment");

    process.env.JWT_SECRET = "secret";
    expect(() => validateJwtSecret()).toThrow("FATAL: Insecure or missing JWT_SECRET in production environment");
  });

  it("does not throw in production when JWT_SECRET is a strong secret", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-very-strong-production-jwt-secret-key-123456";

    expect(() => validateJwtSecret()).not.toThrow();
  });
});
