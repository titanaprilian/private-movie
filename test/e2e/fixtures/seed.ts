import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function seedE2eDatabase(): Promise<void> {
  const databaseUrl =
    process.env.E2E_DATABASE_URL ||
    (process.env.DATABASE_URL?.includes("_test")
      ? process.env.DATABASE_URL
      : "postgres://postgres:root_password@localhost:5432/private_movie_test");

  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
  });

  try {
    const seedSqlPath = join(import.meta.dirname, "seed.sql");
    const seedSql = readFileSync(seedSqlPath, "utf-8");

    // Execute fixture statements
    await sql.unsafe(seedSql);
    console.log("[E2E] Database seeded successfully from seed.sql");
  } catch (err) {
    console.error("[E2E] Failed to seed database:", err);
    throw err;
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  seedE2eDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
