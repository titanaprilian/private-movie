import type { DbClient } from "@repo/db";

export interface SeasonServiceOptions {
  db: DbClient;
}

export { createSeasonRepository } from "./internal/repository";
export { createSeasonService } from "./internal/service";
export {
  SeasonAlreadyExistsError,
  SeasonMissingScraperUrlError,
  SeasonNotEmptyError,
  SeasonNotFoundError,
  SeasonNotOngoingError,
} from "./internal/errors";
export type {
  CreateSeasonInput,
  ScrapeOngoingSeasonResult,
  ScrapeSeasonDelegate,
  SeasonDb,
  SeasonDbClient,
  SeasonRepository,
  SeasonService,
  SeasonServiceDeps,
  SeasonUpsertInput,
  UpdateSeasonInput,
} from "./internal/types";
