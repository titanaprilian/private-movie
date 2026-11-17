import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  createEpisodeRepositoryInternal,
  type EpisodeRepositoryOptions,
} from "@repo/media-service";
import type { EpisodeRepository } from "./types";

export function createEpisodeRepository<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  options?: EpisodeRepositoryOptions,
): EpisodeRepository {
  return createEpisodeRepositoryInternal(db, options);
}
