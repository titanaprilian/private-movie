import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { EmailAlreadyRegisteredError } from "@repo/contracts";
import {
  refreshTokens,
  users,
  type NewRefreshTokenRow,
  type NewUserRow,
  type RefreshTokenRow,
  type UserRow,
} from "@repo/db";

export function authRepository<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<THKT, TSchema>) {
  return {
    async findUserByEmail(email: string): Promise<UserRow | undefined> {
      const [row] = await db.select().from(users).where(eq(users.email, email));
      return row;
    },

    async findUserById(id: string): Promise<UserRow | undefined> {
      const [row] = await db.select().from(users).where(eq(users.id, id));
      return row;
    },

    async insertUser(row: NewUserRow): Promise<void> {
      try {
        await db.insert(users).values(row);
      } catch (e: unknown) {
        // Drizzle may wrap the underlying pg error
        const error = e as {
          cause?: { code?: string; message?: string };
          code?: string;
          message?: string;
        };
        const cause = error.cause || error;

        if (
          cause.code === "23505" ||
          cause.message?.includes("duplicate key value violates unique constraint") ||
          cause.message?.includes("UNIQUE constraint failed")
        ) {
          throw new EmailAlreadyRegisteredError(row.email);
        }
        throw e;
      }
    },

    async incrementFailedAttempts(userId: string): Promise<UserRow> {
      const [updated] = await db
        .update(users)
        .set({
          failedAttempts: sql`${users.failedAttempts} + 1`,
        })
        .where(eq(users.id, userId))
        .returning();
      return updated;
    },

    async lockUser(userId: string, lockedUntil: Date): Promise<void> {
      await db
        .update(users)
        .set({ lockedUntil })
        .where(eq(users.id, userId));
    },

    async resetFailedLoginAttempts(userId: string): Promise<void> {
      await db
        .update(users)
        .set({
          failedAttempts: 0,
          lockedUntil: null,
        })
        .where(eq(users.id, userId));
    },

    async setSessionsValidAfter(userId: string, validAfter: Date): Promise<void> {
      await db
        .update(users)
        .set({ sessionsValidAfter: validAfter })
        .where(eq(users.id, userId));
    },

    async insertRefreshToken(row: NewRefreshTokenRow): Promise<void> {
      await db.insert(refreshTokens).values(row);
    },

    async findRefreshTokenByIdOrHashedToken(
      idOrToken: string,
      hashedToken: string
    ): Promise<RefreshTokenRow | undefined> {
      const [row] = await db
        .select()
        .from(refreshTokens)
        .where(
          sql`${refreshTokens.id} = ${idOrToken} OR ${refreshTokens.token} = ${hashedToken}`
        );
      return row;
    },

    async findRefreshTokenByHashedToken(
      hashedToken: string
    ): Promise<RefreshTokenRow | undefined> {
      const [row] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.token, hashedToken));
      return row;
    },

    async revokeRefreshToken(id: string): Promise<void> {
      await db
        .update(refreshTokens)
        .set({
          revoked: true,
          revokedAt: new Date(),
        })
        .where(eq(refreshTokens.id, id));
    },

    async revokeAllUserRefreshTokens(userId: string): Promise<void> {
      await db
        .update(refreshTokens)
        .set({
          revoked: true,
          revokedAt: sql`COALESCE(${refreshTokens.revokedAt}, NOW())`,
        })
        .where(eq(refreshTokens.userId, userId));
    },

    async deleteActiveRefreshTokens(userId: string): Promise<void> {
      await db
        .delete(refreshTokens)
        .where(
          sql`${refreshTokens.userId} = ${userId} AND ${refreshTokens.revoked} = false`
        );
    },
  };
}
