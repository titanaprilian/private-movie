import { createDbClient } from "./client";
import { repairBackdropUrls } from "./repair-backdrop-urls";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Missing DATABASE_URL environment variable.");
    process.exit(1);
  }

  const db = createDbClient(dbUrl);
  console.log("Running backdrop URL repair script...");
  const { updatedCount } = await repairBackdropUrls(db);
  console.log(`Backdrop URL repair complete. Updated ${updatedCount} row(s).`);
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Backdrop URL repair failed:", err);
    process.exit(1);
  });
}
