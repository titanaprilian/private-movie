import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

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
  await sql.unsafe("TRUNCATE TABLE refresh_tokens, users, system, video_sources, episodes, series CASCADE");
}
