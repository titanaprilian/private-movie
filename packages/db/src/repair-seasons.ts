
import { createDbClient } from "./client";
import { seasons } from "./schema/media";
import { inArray } from "drizzle-orm";

const DB_URL = process.env.DATABASE_URL;
const db = createDbClient(DB_URL);

async function repair() {
  const result = await db.execute(`
      SELECT unnest(ARRAY_AGG(id)) as id
      FROM seasons
      GROUP BY title, description, poster_url, tmdb_season
      HAVING COUNT(*) > 1
  `);
  const duplicateIds = (result as any).map((r: any) => r.id as string);
  console.log(`Found ${duplicateIds.length} duplicate season records.`);
  
  if (duplicateIds.length > 0) {
    const CHUNK_SIZE = 50;
    for (let i = 0; i < duplicateIds.length; i += CHUNK_SIZE) {
      const chunk = duplicateIds.slice(i, i + CHUNK_SIZE);
      await db.update(seasons).set({ tmdbSyncStatus: 'PENDING' }).where(inArray(seasons.id, chunk));
    }
    console.log("Successfully flagged duplicates as PENDING.");
  }
  process.exit(0);
}

repair().catch(console.error);
