import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@repo/contracts";
import { createAuthenticationService } from "../../../src/modules/authentication";
import { signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";

describe("AuthenticationService.verifyAccessToken", () => {
  const authService = createAuthenticationService(db);

  it("resolves user ID for a valid access token", async () => {
    const userId = "user-123-abc";
    const token = signTestToken({ sub: userId, email: "test@example.com" });

    const result = await authService.verifyAccessToken(token);
    expect(result).toBe(userId);
  });

  it("throws UnauthorizedError when token is invalid or garbage", async () => {
    await expect(authService.verifyAccessToken("invalid-token-string")).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("throws UnauthorizedError when token is missing or empty", async () => {
    await expect(authService.verifyAccessToken("")).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when token is expired", async () => {
    const expiredToken = signTestToken({ sub: "user-123" }, { expiresInSeconds: -10 });
    await expect(authService.verifyAccessToken(expiredToken)).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("throws UnauthorizedError when token signature is tampered", async () => {
    const validToken = signTestToken({ sub: "user-123" });
    const tamperedToken = `${validToken.slice(0, -5)}xxxxx`;
    await expect(authService.verifyAccessToken(tamperedToken)).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("throws UnauthorizedError when payload sub is missing", async () => {
    const tokenWithoutSub = signTestToken({ email: "nosub@example.com" });
    await expect(authService.verifyAccessToken(tokenWithoutSub)).rejects.toThrow(
      UnauthorizedError
    );
  });
});
