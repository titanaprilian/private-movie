import { queryOptions } from '@tanstack/react-query';
import { api, extractErrorMessage } from '@/lib/api';
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

export async function fetchHomeFeed(genreSlug?: string): Promise<MediaHomeFeed> {
  const res = await api.series['home-feed'].get({
    $query: {
      genre: genreSlug,
    },
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch home feed'));
  }

  return res.data.data as unknown as MediaHomeFeed;
}

export function homeFeedQueryOptions(genreSlug?: string) {
  return queryOptions({
    queryKey: ['home-feed', genreSlug],
    queryFn: () => fetchHomeFeed(genreSlug),
  });
}
