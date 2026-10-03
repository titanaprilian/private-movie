import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { AuthenticationService } from "@repo/contracts";
import { createAuthenticationServiceInternal } from "./internal/authentication-service";
import { validateJwtSecret } from "./internal/jwt";

export { validateJwtSecret } from "./internal/jwt";

export function createAuthenticationService<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>
): AuthenticationService {
  // Fail fast: a missing or insecure JWT secret must abort startup before
  // any authentication operations occur.
  validateJwtSecret();
  return createAuthenticationServiceInternal(db);
}
