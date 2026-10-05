import { describe, it, expect, vi, beforeEach } from "vitest";

const sentryInit = vi.fn();
const sentryCapture = vi.fn();

vi.mock("@sentry/bun", () => ({
  init: (...args: unknown[]) => sentryInit(...args),
  captureException: (...args: unknown[]) => sentryCapture(...args),
}));

import { initSentry, captureException } from "@/lib/sentry";

beforeEach(() => {
  sentryInit.mockClear();
  sentryCapture.mockClear();
});

describe("initSentry", () => {
  it("no-ops and returns false when SENTRY_DSN is unset", () => {
    expect(initSentry({})).toBe(false);
    expect(sentryInit).not.toHaveBeenCalled();
  });

  it("no-ops and returns false when SENTRY_DSN is empty", () => {
    expect(initSentry({ SENTRY_DSN: "" })).toBe(false);
    expect(sentryInit).not.toHaveBeenCalled();
  });

  it("initializes Sentry and returns true when SENTRY_DSN is set", () => {
    expect(initSentry({ SENTRY_DSN: "https://key@o0.ingest.sentry.io/0" })).toBe(true);
    expect(sentryInit).toHaveBeenCalledTimes(1);
    expect(sentryInit).toHaveBeenCalledWith({
      dsn: "https://key@o0.ingest.sentry.io/0",
    });
  });
});

describe("captureException", () => {
  it("forwards the error and context to the Sentry SDK", () => {
    const error = new Error("boom");
    captureException(error, { route: "/api/health" });
    expect(sentryCapture).toHaveBeenCalledTimes(1);
    expect(sentryCapture).toHaveBeenCalledWith(error, {
      extra: { route: "/api/health" },
    });
  });

  it("forwards without context when none is provided", () => {
    const error = new Error("boom");
    captureException(error);
    expect(sentryCapture).toHaveBeenCalledWith(error, undefined);
  });
});
