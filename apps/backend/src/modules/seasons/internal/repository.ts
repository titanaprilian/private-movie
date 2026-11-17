import type { DbClient } from "@repo/db";
import { createSeasonsRepositoryInternal } from "@repo/media-service";
import type { SeasonRepository } from "./types";

export function createSeasonRepository(db: DbClient): SeasonRepository {
  return createSeasonsRepositoryInternal(db);
}
