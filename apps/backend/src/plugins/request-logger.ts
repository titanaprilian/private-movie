import { Elysia } from "elysia";
import { randomUUID } from "node:crypto";
import type { AppLogger } from "../lib/logger";
import { logger as defaultLogger } from "../lib/logger";

export const REQUEST_ID_HEADER = "x-request-id";

interface RequestState {
  requestId: string;
  startTime: number;
}

const states = new WeakMap<object, RequestState>();

export interface RequestLoggerPluginOptions {
  logger?: Pick<AppLogger, "info">;
}

function getPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

export const requestLoggerPlugin = (options: RequestLoggerPluginOptions = {}) => {
  const log: Pick<AppLogger, "info"> = options.logger ?? defaultLogger;

  return new Elysia({ name: "request-logger-plugin" })
    .onRequest(({ request, set }) => {
      const incoming = request.headers.get(REQUEST_ID_HEADER);
      const requestId =
        incoming && incoming.trim() !== "" ? incoming : randomUUID();
      states.set(request, { requestId, startTime: Date.now() });
      set.headers[REQUEST_ID_HEADER] = requestId;
    })
    .onAfterHandle(({ request, set, status }) => {
      const state = states.get(request);
      if (!state) return;
      set.headers[REQUEST_ID_HEADER] = state.requestId;
      log.info(
        {
          method: request.method,
          path: getPath(request),
          status: typeof status === "number" ? status : (set.status as number | undefined) ?? 200,
          durationMs: Date.now() - state.startTime,
          requestId: state.requestId,
        },
        "request completed"
      );
    })
    .onError(({ request, set, status, code }) => {
      const state =
        (request ? states.get(request) : undefined) ??
        ({ requestId: request?.headers.get(REQUEST_ID_HEADER) || randomUUID(), startTime: Date.now() } as RequestState);
      set.headers[REQUEST_ID_HEADER] = state.requestId;
      const resolvedStatus =
        code === "NOT_FOUND"
          ? 404
          : typeof status === "number"
            ? status
            : ((set.status as number | undefined) ?? 500);
      log.info(
        {
          method: request?.method ?? "UNKNOWN",
          path: request ? getPath(request) : "unknown",
          status: resolvedStatus,
          durationMs: Date.now() - state.startTime,
          requestId: state.requestId,
        },
        "request completed"
      );
    })
    .as("global");
};
