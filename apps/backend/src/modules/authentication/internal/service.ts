import { randomUUID } from "node:crypto";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  AccountLockedError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidRegistrationInputError,
  UnauthorizedError,
  UserNotFoundError,
  type AuthenticationService,
  type RegisterInput,
  type User,
  type VerifyCredentialsInput,
} from "@repo/contracts";
import type { NewRefreshTokenRow, NewUserRow } from "@repo/db";
import { hashPassword, verifyPassword } from "./utils/password";
import { signJwt, verifyJwt, hashRefreshToken } from "./utils/jwt";
import { authRepository } from "./repository";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD_LENGTH = 8;
const DUMMY_HASH = "$argon2id$v=19$m=65536,t=2,p=1$vgjJbKuHqF+jCFy0qUcSfo1mWkV+Pj9N8Fy4zVKvJik$beNSxuPEQ9GrO5koaX8+cwCT5eRfPcDjZuiLWAqRsL8";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateRegistration(input: RegisterInput): void {
  if (!input.name || input.name.trim() === "") {
    throw new InvalidRegistrationInputError("name is required");
  }
  if (!EMAIL_PATTERN.test(input.email.trim())) {
    throw new InvalidRegistrationInputError("email must be a valid email address");
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new InvalidRegistrationInputError(
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
}

function toUser(row: { id: string; email: string; name?: string | null; createdAt: Date }): User {
  return { id: row.id, name: row.name ?? undefined, email: row.email, createdAt: row.createdAt };
}

function newRefreshTokenRow(userId: string, hashedToken: string): NewRefreshTokenRow {
  return {
    id: randomUUID(),
    token: hashedToken,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revoked: false,
    createdAt: new Date(),
  };
}

export function createAuthenticationServiceInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>
): AuthenticationService {
  const repository = authRepository(db);

  return {
    async register(input: RegisterInput): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string }; accessToken: string; refreshToken: string }> {
      validateRegistration(input);
      const email = normalizeEmail(input.email);

      const existing = await repository.findUserByEmail(email);
      if (existing) {
        throw new EmailAlreadyRegisteredError(email);
      }

      const passwordHash = await hashPassword(input.password);
      const row: NewUserRow = {
        id: randomUUID(),
        name: input.name.trim(),
        email,
        passwordHash,
        createdAt: new Date(),
      };

      const user = toUser(row);
      const accessToken = signJwt({ sub: user.id, email: user.email, name: user.name });
      const rawRefreshToken = randomUUID();
      const hashedToken = hashRefreshToken(rawRefreshToken);

      await repository.insertUser(row);
      await repository.insertRefreshToken(newRefreshTokenRow(user.id, hashedToken));

      return {
        user,
        tokens: {
          accessToken,
          refreshToken: rawRefreshToken,
        },
        accessToken,
        refreshToken: rawRefreshToken,
      };
    },

    async verifyCredentials(input: VerifyCredentialsInput): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string }; accessToken: string; refreshToken: string }> {
      const email = normalizeEmail(input.email);

      const row = await repository.findUserByEmail(email);
      if (!row) {
        await verifyPassword(input.password, DUMMY_HASH);
        throw new InvalidCredentialsError();
      }

      if (row.lockedUntil && new Date(row.lockedUntil) > new Date()) {
        throw new AccountLockedError();
      }

      const passwordMatches = await verifyPassword(input.password, row.passwordHash);
      if (!passwordMatches) {
        const updated = await repository.incrementFailedAttempts(row.id);

        if (updated.failedAttempts >= 5) {
          await repository.lockUser(row.id, new Date(Date.now() + 15 * 60 * 1000));
        }

        throw new InvalidCredentialsError();
      }

      if (row.failedAttempts > 0 || row.lockedUntil !== null) {
        await repository.resetFailedLoginAttempts(row.id);
      }

      const user = toUser(row);
      const accessToken = signJwt({ sub: user.id, email: user.email, name: user.name });
      const rawRefreshToken = randomUUID();
      const hashedToken = hashRefreshToken(rawRefreshToken);

      await repository.insertRefreshToken(newRefreshTokenRow(user.id, hashedToken));

      return {
        user,
        tokens: {
          accessToken,
          refreshToken: rawRefreshToken,
        },
        accessToken,
        refreshToken: rawRefreshToken,
      };
    },

    async getUserProfile(userId: string): Promise<User> {
      const row = await repository.findUserById(userId);
      if (!row) {
        throw new UserNotFoundError();
      }
      return toUser(row);
    },

    async logout(idOrToken: string): Promise<void> {
      const hashedToken = hashRefreshToken(idOrToken);
      const tokenRecord = await repository.findRefreshTokenByIdOrHashedToken(
        idOrToken,
        hashedToken
      );

      if (tokenRecord && !tokenRecord.revoked) {
        await repository.revokeRefreshToken(tokenRecord.id);
      }
    },

    async logoutAll(userId: string): Promise<void> {
      await repository.deleteActiveRefreshTokens(userId);
      await repository.setSessionsValidAfter(userId, new Date());
    },

    async refresh(tokenInput: string | { refreshToken: string }): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string }; accessToken: string; refreshToken: string }> {
      let token: string;
      if (typeof tokenInput === "object" && tokenInput !== null && "refreshToken" in tokenInput) {
        token = tokenInput.refreshToken;
      } else if (typeof tokenInput === "string") {
        token = tokenInput;
      } else {
        throw new UnauthorizedError("invalid or expired refresh token");
      }

      const hashedToken = hashRefreshToken(token);

      const tokenRecord = await repository.findRefreshTokenByHashedToken(hashedToken);

      if (!tokenRecord) {
        throw new UnauthorizedError("invalid or expired refresh token");
      }

      if (new Date(tokenRecord.expiresAt) < new Date()) {
        throw new UnauthorizedError("invalid or expired refresh token");
      }

      const userRecord = await repository.findUserById(tokenRecord.userId);

      if (!userRecord) {
        throw new UnauthorizedError("user not found");
      }

      if (userRecord.lockedUntil && new Date(userRecord.lockedUntil) > new Date()) {
        throw new UnauthorizedError("account is locked");
      }

      if (userRecord.sessionsValidAfter && new Date(tokenRecord.createdAt) < new Date(userRecord.sessionsValidAfter)) {
        throw new UnauthorizedError("invalid or expired refresh token");
      }

      if (tokenRecord.revoked) {
        // Reuse detected! Revoke all tokens for this user.
        await repository.revokeAllUserRefreshTokens(tokenRecord.userId);
        throw new UnauthorizedError("refresh token has been revoked");
      }

      // Mark the current token as revoked
      await repository.revokeRefreshToken(tokenRecord.id);

      const user = toUser(userRecord);
      const accessToken = signJwt({ sub: user.id, email: user.email, name: user.name });
      const rawRefreshToken = randomUUID();
      const newHashedToken = hashRefreshToken(rawRefreshToken);

      await repository.insertRefreshToken(newRefreshTokenRow(user.id, newHashedToken));

      return {
        user,
        tokens: {
          accessToken,
          refreshToken: rawRefreshToken,
        },
        accessToken,
        refreshToken: rawRefreshToken,
      };
    },

    async verifyAccessToken(token: string): Promise<string> {
      if (!token || typeof token !== "string") {
        throw new UnauthorizedError("missing or invalid token");
      }
      try {
        const payload = verifyJwt(token);
        if (!payload || !payload.sub) {
          throw new UnauthorizedError("invalid token payload");
        }
        return payload.sub;
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          throw error;
        }
        throw new UnauthorizedError("invalid or expired token");
      }
    },
  };
}
