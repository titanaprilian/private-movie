import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BackendGenre {
  id: string;
  name: string;
  slug: string;
}

export interface BackendSeriesWithMetadata {
  id: string;
  title: string;
  description: string | null;
  type: 'tv' | 'movie';
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: string | null;
  tmdbId: number | null;
  tmdbSyncStatus: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  genres: BackendGenre[];
  seasonsCount: number;
  episodesCount: number;
}

export interface HomeFeedHero extends BackendSeriesWithMetadata {
  tags: string[];
}

export interface HomeFeedRow {
  title: string;
  items: BackendSeriesWithMetadata[];
}

export interface HomeFeedPayload {
  hero: HomeFeedHero | null;
  rows: HomeFeedRow[];
}

function extractErrorMessage(error: unknown, fallback: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (error as any)?.value;
  if (value) {
    if (typeof value.error?.message === 'string') return value.error.message;
    if (typeof value.message === 'string') return value.message;
  }
  return fallback;
}

export async function fetchHomeFeed(): Promise<HomeFeedPayload> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)['home-feed'].get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch home feed'));
  }

  return res.data.data as HomeFeedPayload;
}

export function homeFeedQueryOptions() {
  return queryOptions({
    queryKey: ['home-feed'],
    queryFn: fetchHomeFeed,
  });
}
