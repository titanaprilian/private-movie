import { t } from "elysia";
import type { AuthenticationService, User } from "@repo/contracts";
import type { createAuthenticationServiceInternal } from "./internal/service";

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

export const registerBodySchema = t.Object({
  name: t.String(),
  email: t.String(),
  password: t.String(),
});

export const loginBodySchema = t.Object({
  email: t.String(),
  password: t.String(),
});

export const logoutBodySchema = t.Optional(
  t.Object({
    refreshToken: t.Optional(t.String()),
  }),
);

export const refreshBodySchema = t.Optional(
  t.Object({
    refreshToken: t.Optional(t.String()),
  }),
);

export const registerRouteSchema = {
  body: registerBodySchema,
  detail: {
    tags: ["Authentication"],
    summary: "Register a new user",
    description:
      "Creates a new user account and returns access and refresh tokens.",
  },
};

export const loginRouteSchema = {
  body: loginBodySchema,
  detail: {
    tags: ["Authentication"],
    summary: "Log in",
    description: "Verifies credentials and returns access and refresh tokens.",
  },
};

export const meRouteSchema = {
  detail: {
    tags: ["Authentication"],
    summary: "Get current user",
    description:
      "Returns the profile of the user identified by the bearer access token.",
  },
};

export const logoutRouteSchema = {
  body: logoutBodySchema,
  detail: {
    tags: ["Authentication"],
    summary: "Log out",
    description:
      "Revokes the current refresh token and clears the refresh cookie.",
  },
};

export const logoutAllRouteSchema = {
  detail: {
    tags: ["Authentication"],
    summary: "Log out everywhere",
    description: "Revokes all refresh tokens for the authenticated user.",
  },
};

export const refreshRouteSchema = {
  body: refreshBodySchema,
  detail: {
    tags: ["Authentication"],
    summary: "Refresh tokens",
    description:
      "Exchanges a valid refresh token for a new access and refresh token pair.",
  },
};
