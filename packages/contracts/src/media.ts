/**
 * Client-agnostic public media contract for the MVP surfaces consumed by the
 * web home/watch experiences and the Android TV app.
 *
 * These types mirror the backend success/error envelopes (see
 * `apps/backend/src/lib/response.ts`) and the public series domain shapes, but
 * stay free of framework-specific concerns (no Elysia, no Drizzle) so native
 * clients can reuse the vocabulary.
 */

/** Shared success envelope: every 2xx media response is `{ data: T }`. */
export type MediaSuccessEnvelope<T> = {
  data: T;
};

/** Shared error envelope: every 4xx/5xx media response is `{ error: {...} }`. */
export type MediaErrorEnvelope = {
  error: {
    code: string;
    message: string;
  };
};

export type MediaGenre = {
  id: string;
  name: string;
  slug: string;
};

export type MediaSeriesMetadata = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: string | null;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  genres: MediaGenre[];
  seasonsCount: number;
  episodesCount: number;
};

export type MediaHomeFeedHero = MediaSeriesMetadata & {
  tags: string[];
};

export type MediaHomeFeedRow = {
  title: string;
  items: MediaSeriesMetadata[];
};

export type MediaHomeFeed = {
  hero: MediaHomeFeedHero | null;
  rows: MediaHomeFeedRow[];
};

export type MediaVideoSource = {
  id: string;
  episodeId: string;
  type: string;
  url: string;
  label: string;
  quality: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaEpisodeWithSources = {
  id: string;
  title: string;
  order: number;
  description: string | null;
  seasonId: string | null;
  thumbnailUrl: string | null;
  rating: string | null;
  createdAt: string;
  updatedAt: string;
  videoSources: MediaVideoSource[];
};

export type MediaSeasonWithEpisodes = {
  id: string;
  seriesId: string;
  title: string;
  description: string | null;
  posterUrl: string | null;
  seasonNumber: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  episodes: MediaEpisodeWithSources[];
};

export type MediaSeriesDetails = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: string | null;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  seasons: MediaSeasonWithEpisodes[];
  episodes: MediaEpisodeWithSources[];
  relations: Array<{
    relatedSeriesId: string;
    relationType: string;
  }>;
  genres: MediaGenre[];
};

export type MediaHomeFeedResponse = MediaSuccessEnvelope<MediaHomeFeed>;
export type MediaSeriesDetailsResponse =
  MediaSuccessEnvelope<MediaSeriesDetails>;
