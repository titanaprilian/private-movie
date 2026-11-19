import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { MIGRATIONS_FOLDER } from "@repo/db";
import { resolveTestDatabaseUrl } from "./utils/env";

export async function setup() {
  const testDatabaseUrl = resolveTestDatabaseUrl();
  const url = new URL(testDatabaseUrl);
  const dbName = url.pathname.slice(1);
  const adminUrl = `${url.protocol}//${url.username}:${url.password}@${url.hostname}:${url.port}/postgres`;

  const adminSql = postgres(adminUrl);
  try {
    const result =
      await adminSql`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (result.length === 0) {
      await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
      console.log(`Created database: ${dbName}`);
    }
  } finally {
    await adminSql.end();
  }

  const testSql = postgres(testDatabaseUrl);
  const testDb = drizzle(testSql);

  try {
    await migrate(testDb, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await testSql.end();
  }
}
