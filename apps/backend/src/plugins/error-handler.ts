import { Elysia } from "elysia";
import { errorResponse, deriveErrorCode } from "../lib/response";
import { InternalServerError, getDomainErrorStatus } from "../lib/errors";
import { logger as defaultLogger, type AppLogger } from "../lib/logger";
import { captureException as defaultCaptureException } from "../lib/sentry";

export interface ErrorHandlerPluginOptions {
  logger?: Pick<AppLogger, "warn" | "error">;
  captureException?: (error: unknown, context?: Record<string, unknown>) => void;
}

function getPath(request: Request | undefined): string {
  if (!request) return "unknown";
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

interface ValidationIssueLike {
  path?: string;
  message?: string;
  summary?: string;
  params?: unknown;
}

/**
 * Inspects Elysia validation failures and returns a serializable
 * breakdown. Uses the schema validator's `Errors(value)` iterator when
 * available, falling back to the raw error message.
 */
function summarizeValidationIssues(error: unknown): unknown[] {
  const candidate = error as {
    validator?: { Errors?: (value: unknown) => Iterable<ValidationIssueLike> };
    value?: unknown;
    message?: string;
  } | null;
  try {
    const validator = candidate?.validator;
    const errorsFn = validator?.Errors;
    if (validator && typeof errorsFn === "function") {
      const issues: unknown[] = [];
      for (const issue of errorsFn.call(validator, candidate?.value)) {
        issues.push({
          path: issue.path ?? "",
          message: issue.message ?? issue.summary ?? "validation failed",
          params: issue.params,
        });
      }
      if (issues.length > 0) {
        return issues;
      }
    }
  } catch {
    // Fall through to the message fallback below.
  }
  return [{ message: candidate?.message ?? String(error) }];
}

/**
 * Global error handler plugin. Maps Elysia validation errors to 400,
 * domain errors to their respective status codes, and unhandled errors
 * to logged 500s. Lets 404s pass through untouched.
 *
 * Logging policy (Pino, never changes response envelopes):
 * - 400 validation errors: `warn` with the validation breakdown.
 *   Never forwarded to Sentry (client error, not a crash).
 * - 4xx domain errors: `warn` with route, status, and error code.
 *   Never forwarded to Sentry.
 * - 500 unhandled errors: captured in Sentry with request context and
 *   logged at `error` with the full stack trace.
 *
 * `.as("global")` promotes the hook to the composing application so it
 * catches errors from routes registered after `.use()` (a bare instance
 * plugin would only guard its own routes).
 */
export const errorHandlerPlugin = (options: ErrorHandlerPluginOptions = {}) =>
  new Elysia({ name: "error-handler-plugin" })
    .onError(({ code, set, error, request }) => {
      const log = options.logger ?? defaultLogger;
      const capture = options.captureException ?? defaultCaptureException;
      if (code === "NOT_FOUND") {
        return;
      }
      if (code === "VALIDATION") {
        set.status = 400;
        log.warn(
          {
            route: getPath(request),
            status: 400,
            validationIssues: summarizeValidationIssues(error),
            requestId: request?.headers.get("x-request-id") ?? undefined,
          },
          "request validation failed"
        );
        return {
          error: {
            code: "VALIDATION",
            message: "request validation failed",
          },
        };
      }
      const domainStatus = getDomainErrorStatus(error);
      if (domainStatus !== null) {
        log.warn(
          {
            route: getPath(request),
            status: domainStatus,
            code: error instanceof Error ? deriveErrorCode(error) : "UNKNOWN",
            requestId: request?.headers.get("x-request-id") ?? undefined,
          },
          "domain error"
        );
        return errorResponse(set, domainStatus, error as Error);
      }
      const err = error instanceof Error ? error : new Error(String(error));
      capture(err, {
        method: request?.method,
        route: getPath(request),
        requestId: request?.headers.get("x-request-id") ?? undefined,
      });
      log.error(
        {
          route: getPath(request),
          status: 500,
          err,
        },
        "[Unhandled Server Error]"
      );
      return errorResponse(set, 500, new InternalServerError());
    })
    .as("global");
