import { Elysia } from "elysia";
import { rateLimit } from "@elysiajs/rate-limit";
import {
  AccountLockedError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidRegistrationInputError,
  UnauthorizedError,
  UserNotFoundError,
  type User,
  type AuthenticationService,
} from "@repo/contracts";
import { errorResponse, successResponse } from "../../lib/response";
import { getClientIp } from "../../lib/ip";
import { createAuthenticationServiceInternal } from "./internal/service";
import {
  loginRouteSchema,
  logoutAllRouteSchema,
  logoutRouteSchema,
  meRouteSchema,
  refreshRouteSchema,
  registerRouteSchema,
} from "./schemas";
export interface AuthRateLimitOptions {
  disabled?: boolean;
  max?: number;
  duration?: number;
}
export interface AuthRoutesOptions {
  db?: Parameters<typeof createAuthenticationServiceInternal>[0];
  authService?: AuthenticationService;
  rateLimit?: AuthRateLimitOptions;
}
export interface AuthResultPayload {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
}
function handleAuthResponse(
  r: AuthResultPayload,
  headers: Record<string, string | undefined>,
  c: { set: (o: Record<string, unknown>) => void },
) {
  if (headers["x-client-type"] === "mobile")
    return successResponse({
      ...r.user,
      user: r.user,
      tokens: {
        accessToken: r.tokens.accessToken,
        refreshToken: r.tokens.refreshToken,
      },
    });
  c.set({
    value: r.tokens.refreshToken,
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "lax",
  });
  return successResponse({
    ...r.user,
    user: r.user,
    tokens: { accessToken: r.tokens.accessToken },
  });
}
function rateLimitPlugin(
  o: AuthRateLimitOptions | undefined,
  disabled: boolean,
) {
  return rateLimit({
    duration: o?.duration ?? 60000,
    max: o?.max ?? 10,
    generator: (req, srv) => `${getClientIp(req, srv)}:login`,
    errorResponse: new Response(
      JSON.stringify({
        error: { code: "RATE_LIMIT", message: "rate-limit reached" },
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    ),
    skip: (req) =>
      disabled || !new URL(req.url).pathname.endsWith("/auth/login"),
  });
}
function clearRefreshCookie(c: { set: (o: Record<string, unknown>) => void }) {
  c.set({
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}
function bearerToken(
  headers: Record<string, string | undefined>,
): string | undefined {
  const h = headers["authorization"];
  return h?.startsWith("Bearer ") ? h.substring(7) : undefined;
}
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
