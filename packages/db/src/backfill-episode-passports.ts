import { sql } from "drizzle-orm";
import type { DbClient } from "./client";

export interface BackfillEpisodePassportsResult {
  updatedCount: number;
}

/**
 * Backfills TMDB passport numbers for existing episodes where they are NULL.
 *
 * - `tmdb_season_number` derives from the parent season's `season_number`
 *   with a fallback to 1 when the season has no number.
 * - `tmdb_episode_number` derives from the episode's own `order`.
 * - Episodes that already have both passport numbers set are left untouched,
 *   making the backfill idempotent.
 */
export async function backfillEpisodePassports(
  db: DbClient,
): Promise<BackfillEpisodePassportsResult> {
  const result = await db.execute(
    sql`UPDATE episodes SET tmdb_season_number = COALESCE(seasons.season_number, 1), tmdb_episode_number = episodes."order" FROM seasons WHERE episodes.season_id = seasons.id AND (episodes.tmdb_season_number IS NULL OR episodes.tmdb_episode_number IS NULL)`,
  );

  const raw = result as unknown as {
    rowCount?: unknown;
    count?: unknown;
    rows?: unknown[];
  };
  // postgres.js (used via drizzle `db.execute`) returns write results as an
  // array with a `.count` property instead of `.rowCount`.
  const updatedCount = raw?.rowCount ?? raw?.count ?? raw?.rows?.length ?? 0;

  return { updatedCount: typeof updatedCount === "number" ? updatedCount : 0 };
}
