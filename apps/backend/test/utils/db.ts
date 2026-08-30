import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

function resolveTestDatabaseUrl(): string {
  const envUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!envUrl) {
    throw new Error("DATABASE_URL is not defined");
  }
  try {
    const url = new URL(envUrl);
    if (!url.pathname.endsWith("_test")) {
      url.pathname = `${url.pathname}_test`;
    }
    return url.toString();
  } catch {
    return envUrl;
  }
}

export const databaseUrl = resolveTestDatabaseUrl();

if (!databaseUrl.includes("_test")) {
  throw new Error(
    `SAFETY ERROR: Refusing to run tests against non-test database: ${databaseUrl}`
  );
}

// Override process.env.DATABASE_URL during test execution so child connections use test DB
process.env.DATABASE_URL = databaseUrl;

/**
 * Long-lived postgres.js connection used throughout the integration test
 * process. It is intentionally never closed so that the test runner, global
 * setup, and per-test setup can all reuse the same connection pool.
 */
export const sql = postgres(databaseUrl);
export const db = drizzle(sql);

/**
 * Truncate all application tables. Called automatically before each integration
 * test via the global `beforeEach` registered in `test/setup.ts`.
 */
export async function truncateAll(): Promise<void> {
  if (!databaseUrl.includes("_test")) {
    throw new Error(
      `SAFETY ERROR: Refusing to truncate non-test database: ${databaseUrl}`
    );
  }
  await sql.unsafe(
    "TRUNCATE TABLE refresh_tokens, users, system, video_sources, episodes, series_to_genres, seasons, series, genres CASCADE"
  );
}
