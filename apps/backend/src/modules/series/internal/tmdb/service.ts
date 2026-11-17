import type { DbClient } from "@repo/db";
import {
  createMediaService,
  type MediaService,
  type MediaServiceOptions,
} from "@repo/media-service";

export type TmdbService = MediaService;
export type TmdbServiceOptions = MediaServiceOptions;

export function tmdbService(
  db: DbClient,
  options?: TmdbServiceOptions,
): TmdbService {
  return createMediaService(db, options);
}
