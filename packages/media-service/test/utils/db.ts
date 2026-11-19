import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { resolveTestDatabaseUrl } from "./env";

export const databaseUrl = resolveTestDatabaseUrl();

if (!databaseUrl.includes("_test")) {
  throw new Error(
    `SAFETY ERROR: Refusing to run tests against non-test database: ${databaseUrl}`,
  );
}

process.env.DATABASE_URL = databaseUrl;

export const sql = postgres(databaseUrl);
export const db = drizzle(sql);

export async function truncateAll(): Promise<void> {
  if (!databaseUrl.includes("_test")) {
    throw new Error(
      `SAFETY ERROR: Refusing to truncate non-test database: ${databaseUrl}`,
    );
  }
  await sql.unsafe(
    "TRUNCATE TABLE refresh_tokens, users, system, video_sources, storage_providers, episodes, series_to_genres, seasons, series, genres CASCADE",
  );
}
