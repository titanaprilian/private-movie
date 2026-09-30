import { createDbClient } from "./client";
import { backfillEpisodePassports } from "./backfill-episode-passports";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Missing DATABASE_URL environment variable.");
    process.exit(1);
  }

  const db = createDbClient(dbUrl);
  console.log("Running episode passport backfill...");
  const { updatedCount } = await backfillEpisodePassports(db);
  console.log(`Episode passport backfill complete. Updated ${updatedCount} row(s).`);
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Episode passport backfill failed:", err);
    process.exit(1);
  });
}
