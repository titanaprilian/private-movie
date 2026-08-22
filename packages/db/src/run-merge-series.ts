import { createDbClient } from "./client";
import { mergeSeries } from "./merge-series";

export async function runMergeSeries(): Promise<void> {
  const db = createDbClient();
  const isDryRun = process.argv.includes("--dry-run") || true;

  try {
    const summary = await mergeSeries({
      db,
      dryRun: isDryRun,
    });
    console.log(`\nFinished series merge dry-run for ${summary.processedTmdbIds} TMDB IDs.`);
    await db.$client.end();
    process.exit(0);
  } catch (error) {
    console.error("Series merge script failed:", error);
    await db.$client.end().catch(() => {});
    process.exit(1);
  }
}

if (import.meta.main) {
  runMergeSeries();
}
