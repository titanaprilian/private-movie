import { Elysia } from "elysia";
import { errorResponse } from "../lib/response";
import { InternalServerError, getDomainErrorStatus } from "../lib/errors";

/**
 * Global error handler plugin. Maps Elysia validation errors to 400,
 * domain errors to their respective status codes, and unhandled errors
 * to logged 500s. Lets 404s pass through untouched.
 *
 * `.as("global")` promotes the hook to the composing application so it
 * catches errors from routes registered after `.use()` (a bare instance
 * plugin would only guard its own routes).
 */
export const errorHandlerPlugin = () =>
  new Elysia({ name: "error-handler-plugin" })
    .onError(({ code, set, error }) => {
      if (code === "NOT_FOUND") {
        return;
      }
      if (code === "VALIDATION") {
        set.status = 400;
        return {
          error: {
            code: "VALIDATION",
            message: "request validation failed",
          },
        };
      }
      const domainStatus = getDomainErrorStatus(error);
      if (domainStatus !== null) {
        return errorResponse(set, domainStatus, error as Error);
      }
      console.error("[Unhandled Server Error]", error);
      return errorResponse(set, 500, new InternalServerError());
    })
    .as("global");
