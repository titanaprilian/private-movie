import { createDbClient } from "./client";
import { migrateGenres } from "./migrate-genres";

export async function runMigrateGenres(): Promise<void> {
  const db = createDbClient();
  try {
    const result = await migrateGenres(db);
    console.log(`Genres migration finished: ${result.genresCount} genres, ${result.mappingsCount} series-genre mappings processed.`);
    await db.$client.end();
    process.exit(0);
  } catch (error) {
    console.error("Genres migration failed:", error);
    await db.$client.end().catch(() => {});
    process.exit(1);
  }
}

if (import.meta.main) {
  runMigrateGenres();
}
