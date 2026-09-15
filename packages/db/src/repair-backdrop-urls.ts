import { sql } from "drizzle-orm";
import type { DbClient } from "./client";

export interface RepairBackdropUrlsResult {
  updatedCount: number;
}

export async function repairBackdropUrls(db: DbClient): Promise<RepairBackdropUrlsResult> {
  const result = await db.execute(
    sql`UPDATE series SET backdrop_url = REPLACE(backdrop_url, '/t/p/w500/', '/t/p/original/') WHERE backdrop_url LIKE '%image.tmdb.org/t/p/w500/%'`
  );

  const updatedCount = (result as any)?.rowCount ?? (result as any)?.rows?.length ?? 0;
  return { updatedCount };
}
