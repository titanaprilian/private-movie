import type {
  S3StorageService,
  StorageProviderRegistry,
} from "@repo/media-service";
import type { EpisodeRow, VideoSourceRow } from "@repo/db";

export interface EpisodeRepositoryOptions {
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

export type EpisodeWithVideoSources = EpisodeRow & {
  videoSources: VideoSourceRow[];
};

export interface UpdateEpisodeInput {
  title?: string;
  description?: string | null;
}

export interface EpisodeOrderUpdateInput {
  id: string;
  order: number;
  seasonId?: string;
}

export interface EpisodeUpsertInput {
  seasonId?: string | null;
  seriesId?: string | null;
  title: string;
  order?: number;
  description?: string | null;
  duration?: number | null;
  tmdbId?: number | null;
  tmdbSeasonNumber?: number | null;
  tmdbEpisodeNumber?: number | null;
  isUnassigned?: boolean;
  thumbnailUrl?: string | null;
  rating?: string | null;
  airDate?: Date | null;
}

export interface EpisodeListParams {
  page: number;
  limit?: number;
  seasonId?: string;
}

export interface EpisodeListResult {
  episodes: EpisodeWithVideoSources[];
  total: number;
}

export interface EpisodeRepository {
  upsert(input: EpisodeUpsertInput): Promise<EpisodeRow>;
  findBySeasonIdAndOrder(
    seasonId: string,
    order: number,
  ): Promise<EpisodeRow | null>;
  findById(id: string): Promise<EpisodeWithVideoSources | null>;
  getMaxOrder(seasonId: string | null): Promise<number>;
  list(params: EpisodeListParams): Promise<EpisodeListResult>;
  updateEpisode(
    id: string,
    input: Partial<UpdateEpisodeInput>,
  ): Promise<EpisodeWithVideoSources>;
  updateOrders(items: EpisodeOrderUpdateInput[]): Promise<void>;
  deleteEpisode(id: string): Promise<EpisodeRow>;
}
