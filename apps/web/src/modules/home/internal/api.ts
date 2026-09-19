import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  MediaGenre,
  MediaHomeFeed,
  MediaHomeFeedHero,
  MediaHomeFeedRow,
  MediaSeriesMetadata,
} from '@repo/contracts';

export type {
  MediaGenre,
  MediaHomeFeed,
  MediaHomeFeedHero,
  MediaHomeFeedRow,
  MediaSeriesMetadata,
};

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'value' in error) {
    const value = (error as { value?: unknown }).value;
    if (value && typeof value === 'object') {
      const errObj = value as { error?: { message?: string }; message?: string };
      if (typeof errObj.error?.message === 'string') return errObj.error.message;
      if (typeof errObj.message === 'string') return errObj.message;
    }
  }
  return fallback;
}

export async function fetchHomeFeed(): Promise<MediaHomeFeed> {
  const res = await api.series['home-feed'].get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch home feed'));
  }

  return res.data.data as unknown as MediaHomeFeed;
}

export function homeFeedQueryOptions() {
  return queryOptions({
    queryKey: ['home-feed'],
    queryFn: fetchHomeFeed,
  });
}
