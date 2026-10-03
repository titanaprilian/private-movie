import { describe, expect, it } from "vitest";
import {
  loadAppConfig,
  isOriginAllowed,
  isApiDocsEnabled,
  type AppConfig,
} from "../../../src/config/app-config";

describe("loadAppConfig", () => {
  it("parses development mode from a custom env dictionary", () => {
    const config = loadAppConfig({ NODE_ENV: "development" });
    expect(config.isDevelopment).toBe(true);
    expect(config.allowedOrigins).toEqual([]);
  });

  it("parses the CORS origin allowlist from a custom env dictionary", () => {
    const config = loadAppConfig({
      NODE_ENV: "production",
      CORS_ORIGIN: "https://app.example.com, https://admin.example.com ,,",
    });
    expect(config.isDevelopment).toBe(false);
    expect(config.allowedOrigins).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("falls back to the default production origin when none is configured", () => {
    const config = loadAppConfig({ NODE_ENV: "production" });
    expect(config.allowedOrigins).toEqual(["http://localhost:5173"]);
  });

  it("derives the API docs flag purely from the provided dictionary", () => {
    expect(
      loadAppConfig({ NODE_ENV: "production" }).apiDocsEnabled
    ).toBe(false);
    expect(
      loadAppConfig({ NODE_ENV: "production", ENABLE_API_DOCS: "true" })
        .apiDocsEnabled
    ).toBe(true);
    expect(loadAppConfig({ NODE_ENV: "test" }).apiDocsEnabled).toBe(true);
  });

  it("does not read global process state when a dictionary is provided", () => {
    const savedOrigin = process.env.CORS_ORIGIN;
    const savedEnv = process.env.NODE_ENV;
    process.env.CORS_ORIGIN = "https://global.example.com";
    process.env.NODE_ENV = "production";
    try {
      const config = loadAppConfig({
        NODE_ENV: "development",
        CORS_ORIGIN: "https://custom.example.com",
      });
      expect(config.isDevelopment).toBe(true);
      expect(config.allowedOrigins).toEqual([]);
    } finally {
      if (savedOrigin === undefined) delete process.env.CORS_ORIGIN;
      else process.env.CORS_ORIGIN = savedOrigin;
      if (savedEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = savedEnv;
    }
  });
});

describe("isApiDocsEnabled", () => {
  it("reflects the provided dictionary without touching process.env", () => {
    expect(isApiDocsEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(
      isApiDocsEnabled({ NODE_ENV: "production", ENABLE_API_DOCS: "true" })
    ).toBe(true);
    expect(isApiDocsEnabled({ NODE_ENV: "development" })).toBe(true);
  });
});

describe("isOriginAllowed in development mode", () => {
  const config: AppConfig = {
    allowedOrigins: [],
    apiDocsEnabled: true,
    isDevelopment: true,
  };

  it("permits any incoming origin", () => {
    expect(isOriginAllowed("http://localhost:5173", config)).toBe(true);
    expect(isOriginAllowed("https://anything.example.com", config)).toBe(true);
  });

  it("rejects requests without an origin", () => {
    expect(isOriginAllowed(null, config)).toBe(false);
    expect(isOriginAllowed(undefined, config)).toBe(false);
    expect(isOriginAllowed("", config)).toBe(false);
  });
});

describe("isOriginAllowed in production mode", () => {
  const config: AppConfig = {
    allowedOrigins: ["https://app.example.com"],
    apiDocsEnabled: false,
    isDevelopment: false,
  };

  it("permits listed origins", () => {
    expect(isOriginAllowed("https://app.example.com", config)).toBe(true);
  });

  it("rejects unlisted origins and missing origins", () => {
    expect(isOriginAllowed("https://evil.example.com", config)).toBe(false);
    expect(isOriginAllowed(null, config)).toBe(false);
    expect(isOriginAllowed(undefined, config)).toBe(false);
  });

  it("rejects every origin when the allowlist is empty", () => {
    const empty: AppConfig = { ...config, allowedOrigins: [] };
    expect(isOriginAllowed("https://app.example.com", empty)).toBe(false);
  });
});
