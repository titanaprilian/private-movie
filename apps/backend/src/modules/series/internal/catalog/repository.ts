import type { DbClient } from "@repo/db";
import {
  createSeriesRepositoryInternal,
  type SeriesRepository,
  type SeriesRepositoryOptions,
} from "@repo/media-service";

export function createSeriesRepository(
  db: DbClient,
  options?: SeriesRepositoryOptions,
): SeriesRepository {
  return createSeriesRepositoryInternal(db, options);
}
