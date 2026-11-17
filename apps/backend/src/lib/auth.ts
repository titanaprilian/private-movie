import { UnauthorizedError, type AuthenticationService } from "@repo/contracts";

export const authGuard = (authService: AuthenticationService) => {
  return async ({
    headers,
  }: {
    headers: Record<string, string | undefined>;
  }) => {
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
