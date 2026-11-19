import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

function resolveTestDatabaseUrl(): string {
  const envUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!envUrl) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL is not defined");
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
