import { Elysia } from "elysia";
import { UnauthorizedError, type AuthenticationService } from "@repo/contracts";

export const authGuard = (authService: AuthenticationService) => {
  return async ({ headers }: { headers: Record<string, string | undefined> }) => {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("missing or invalid authorization header");
    }
    const token = authHeader.substring(7);
    try {
      await authService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("unauthorized");
    }
  };
};

export const createAuthPlugin = (authService: AuthenticationService) =>
  new Elysia({ name: "auth" }).derive(
    async ({ headers }: { headers: Record<string, string | undefined> }) => {
      const authHeader = headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { userId: undefined };
      }
      const token = authHeader.substring(7);
      try {
        const userId = await authService.verifyAccessToken(token);
        return { userId };
      } catch {
        return { userId: undefined };
      }
    }
  );
