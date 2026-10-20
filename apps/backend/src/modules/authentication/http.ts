import { Elysia } from "elysia";
import {
  AccountLockedError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidRegistrationInputError,
  UnauthorizedError,
  UserNotFoundError,
} from "@repo/contracts";
import { errorResponse, successResponse } from "../../lib/response";
import { createAuthenticationServiceInternal } from "./internal/service";
import {
  bearerToken,
  clearRefreshCookie,
  handleAuthResponse,
  rateLimitPlugin,
} from "./internal/utils/http";
import {
  loginRouteSchema,
  logoutAllRouteSchema,
  logoutRouteSchema,
  meRouteSchema,
  refreshRouteSchema,
  registerRouteSchema,
  type AuthRoutesOptions,
} from "./schemas";

export type { AuthRoutesOptions } from "./schemas";

export const authRoutes = (options: AuthRoutesOptions) => {
  const auth =
    options.authService ?? createAuthenticationServiceInternal(options.db!);
  const disabled = options.rateLimit?.disabled ?? false;
  return new Elysia({ name: "auth-routes" })
    .use(rateLimitPlugin(options.rateLimit, disabled))
    .post(
      "/auth/register",
      async ({ body, set, headers, cookie: { refreshToken } }) => {
        try {
          return handleAuthResponse(
            await auth.register(body),
            headers,
            refreshToken,
          );
        } catch (e) {
          if (e instanceof EmailAlreadyRegisteredError)
            return errorResponse(set, 409, e);
          if (e instanceof InvalidRegistrationInputError)
            return errorResponse(set, 400, e);
          throw e;
        }
      },
      registerRouteSchema,
    )
    .post(
      "/auth/login",
      async ({ body, set, headers, cookie: { refreshToken } }) => {
        try {
          return handleAuthResponse(
            await auth.verifyCredentials(body),
            headers,
            refreshToken,
          );
        } catch (e) {
          if (e instanceof InvalidCredentialsError)
            return errorResponse(set, 401, e);
          if (e instanceof AccountLockedError)
            return errorResponse(set, 429, e);
          throw e;
        }
      },
      loginRouteSchema,
    )
    .get(
      "/auth/me",
      async ({ headers, set }) => {
        const token = bearerToken(headers);
        if (!token)
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header"),
          );
        try {
          return successResponse(
            await auth.getUserProfile(await auth.verifyAccessToken(token)),
          );
        } catch (e) {
          if (e instanceof UserNotFoundError) return errorResponse(set, 404, e);
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }
      },
      meRouteSchema,
    )
    .post(
      "/auth/logout",
      async ({ body, set, cookie: { refreshToken } }) => {
        const token =
          (body as Record<string, unknown> | undefined)?.refreshToken ||
          refreshToken?.value;
        if (typeof token !== "string")
          return errorResponse(
            set,
            400,
            new InvalidRegistrationInputError("refresh token is required"),
          );
        await auth.logout(token);
        clearRefreshCookie(refreshToken);
        return successResponse({ success: true });
      },
      logoutRouteSchema,
    )
    .post(
      "/auth/logout-all",
      async ({ headers, set, cookie: { refreshToken } }) => {
        const token = bearerToken(headers);
        if (!token)
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header"),
          );
        try {
          await auth.logoutAll(await auth.verifyAccessToken(token));
          clearRefreshCookie(refreshToken);
          return successResponse({ success: true });
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }
      },
      logoutAllRouteSchema,
    )
    .post(
      "/auth/refresh",
      async ({ body, set, headers, cookie: { refreshToken } }) => {
        const token =
          (body as Record<string, unknown> | undefined)?.refreshToken ||
          refreshToken?.value;
        if (typeof token !== "string")
          return errorResponse(
            set,
            401,
            new UnauthorizedError("refresh token is required"),
          );
        try {
          return handleAuthResponse(
            await auth.refresh(token),
            headers,
            refreshToken,
          );
        } catch (e) {
          if (e instanceof UnauthorizedError) return errorResponse(set, 401, e);
          throw e;
        }
      },
      refreshRouteSchema,
    );
};
