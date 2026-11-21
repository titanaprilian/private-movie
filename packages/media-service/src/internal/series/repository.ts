import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  fetchRecentlyAddedEpisodes,
  fetchOngoingRow,
  getHomeFeed,
} from "./feed";
import { upsert, updateSeries, deleteSeries } from "./mutations";
import { findById, findByTmdbId, findByIdWithEpisodes, list } from "./queries";
import type { SeriesRepository, SeriesRepositoryOptions } from "./types";

export * from "./types";
export * from "./feed";
export * from "./queries";
export * from "./mutations";

export function createSeriesRepositoryInternal<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  options?: SeriesRepositoryOptions,
): SeriesRepository {
  return {
    upsert: (input) => upsert(db, input),
    findById: (id) => findById(db, id),
    findByTmdbId: (tmdbId) => findByTmdbId(db, tmdbId),
    findByIdWithEpisodes: (id, sourceTypes) =>
      findByIdWithEpisodes(db, id, sourceTypes, options),
    list: (params) => list(db, params),
    updateSeries: (id, input) => updateSeries(db, id, input),
    deleteSeries: (id) => deleteSeries(db, id),
    getHomeFeed: (sourceTypes) => getHomeFeed(db, sourceTypes, options),
  };
}
