import * as Sentry from "@sentry/bun";

export interface SentryInitEnv {
  SENTRY_DSN?: string;
  [key: string]: string | undefined;
}

/**
 * Initializes Sentry crash reporting when a DSN is configured.
 * Gracefully no-ops (returns false) when `SENTRY_DSN` is unset or empty,
 * so local development and tests never require Sentry credentials.
 *
 * @returns true when Sentry was initialized, false when skipped.
 */
export function initSentry(env: SentryInitEnv = process.env): boolean {
  const dsn = env.SENTRY_DSN;
  if (!dsn) {
    return false;
  }
  Sentry.init({ dsn });
  return true;
}

/**
 * Forwards an unhandled error to Sentry with request context.
 * Thin wrapper seam so the error handler stays unit-testable without
 * touching the Sentry SDK (inject a spy instead).
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
