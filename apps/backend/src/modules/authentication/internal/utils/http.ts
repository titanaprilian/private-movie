import { rateLimit } from "@elysiajs/rate-limit";
import { successResponse } from "../../../../lib/response";
import { getClientIp } from "../../../../lib/ip";
import {
  type AuthRateLimitOptions,
  type AuthResultPayload,
} from "../../schemas";

export function handleAuthResponse(
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

export function rateLimitPlugin(
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

export function clearRefreshCookie(c: {
  set: (o: Record<string, unknown>) => void;
}) {
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

export function bearerToken(
  headers: Record<string, string | undefined>,
): string | undefined {
  const h = headers["authorization"];
  return h?.startsWith("Bearer ") ? h.substring(7) : undefined;
}
