import type {
  EpisodeRow,
  SeasonRow,
  SeriesRow,
  VideoSourceRow,
} from "@repo/db";
import type { EpisodeWithVideoSources } from "../episodes/repository";
import type { S3StorageService } from "../s3/s3-storage-service";
import type { StorageProviderRegistry } from "../s3/registry";

export interface SeriesRepositoryOptions {
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

export class SeriesNotFoundError extends Error {
  constructor(message = "Series not found") {
    super(message);
    this.name = "SeriesNotFoundError";
  }
}

export class SeriesHighlightWithoutOngoingError extends Error {
  constructor(message = "Cannot highlight a series with no ongoing seasons") {
    super(message);
    this.name = "SeriesHighlightWithoutOngoingError";
  }
}

export function compareSeasons<
  T extends { seasonNumber?: number | null; createdAt?: Date | string | null },
>(a: T, b: T): number {
  const getGroup = (season: T) => {
    const s = season.seasonNumber;
    if (s !== null && s !== undefined && s > 0) return 1;
    if (s === 0) return 2;
    return 3;
  };

  const groupA = getGroup(a);
  const groupB = getGroup(b);

  if (groupA !== groupB) {
    return groupA - groupB;
  }

  if (groupA === 1) {
    const tmdbA = a.seasonNumber!;
    const tmdbB = b.seasonNumber!;
    if (tmdbA !== tmdbB) {
      return tmdbA - tmdbB;
    }
  }

  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return timeA - timeB;
}

export interface SeriesUpsertInput {
  id?: string;
  sourceUrl?: string;
  source?: string;
  title: string;
  description?: string | null;
  type?: "tv" | "movie";
  posterUrl?: string | null;
  backdropUrl?: string | null;
  rating?: string | null;
  tmdbId?: number | null;
  tmdbSyncStatus?: "PENDING" | "SYNCED" | "FAILED";
}

export interface UpdateSeriesInput {
  title?: string;
  description?: string | null;
  type?: "tv" | "movie";
  posterUrl?: string | null;
  logoUrl?: string | null;
  backdropUrl?: string | null;
  rating?: string | null;
  tmdbId?: number | null;
  seasonNumber?: number | null;
  tmdbSyncStatus?: "PENDING" | "SYNCED" | "FAILED";
  isFeatured?: boolean;
  isOngoingHighlighted?: boolean;
  genreIds?: string[];
}

export interface SeriesListParams {
  page: number;
  limit?: number;
  source?: string;
  q?: string;
  genre?: string;
  filter?: "all" | "featured" | "ongoing";
  highlighted?: boolean;
}

export type SeasonWithEpisodes = SeasonRow & {
  episodes: EpisodeWithVideoSources[];
};

export type SeriesWithSeasons = SeriesRow & {
  seasons: SeasonRow[];
  genres?: Array<{ id: string; name: string; slug: string }>;
};

export interface SeriesListResult {
  series: SeriesWithSeasons[];
  total: number;
}

export type SeriesWithEpisodes = SeriesRow & {
  seasons: SeasonWithEpisodes[];
  episodes: EpisodeWithVideoSources[];
  genres?: Array<{ id: string; name: string; slug: string }>;
};

export interface SeriesWithMetadata extends SeriesRow {
  genres: Array<{ id: string; name: string; slug: string }>;
  seasonsCount: number;
  episodesCount: number;
}

export interface HomeFeedHero extends SeriesWithMetadata {
  tags: string[];
}

export interface HomeFeedRow {
  title: string;
  items: SeriesWithMetadata[];
}

export interface RecentlyAddedEpisode {
  id: string;
  title: string;
  order: number;
  thumbnailUrl: string | null;
  duration: number | null;
  rating: string | null;
  createdAt: string;
  series: {
    id: string;
    title: string;
    posterUrl: string | null;
    backdropUrl: string | null;
  };
  season: {
    id: string;
    seasonNumber: number | null;
    title: string;
  };
  videoSources: VideoSourceRow[];
}

export interface HomeFeedPayload {
  hero: HomeFeedHero | null;
  heroes: HomeFeedHero[];
  rows: HomeFeedRow[];
  recentlyAddedEpisodes: RecentlyAddedEpisode[];
}

export interface SeriesRepository {
  upsert(input: SeriesUpsertInput): Promise<SeriesRow>;
  findById(id: string): Promise<SeriesRow | null>;
  findByTmdbId(tmdbId: number): Promise<SeriesRow | null>;
  findByIdWithEpisodes(
    id: string,
    sourceTypes?: string[],
  ): Promise<SeriesWithEpisodes | null>;
  list(params: SeriesListParams): Promise<SeriesListResult>;
  updateSeries(
    id: string,
    input: UpdateSeriesInput,
  ): Promise<SeriesWithSeasons>;
  deleteSeries(id: string): Promise<SeriesRow>;
  getHomeFeed(sourceTypes?: string[]): Promise<HomeFeedPayload>;
}
