import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface WatchVideoSource {
  id: string;
  type: 'embed' | 'direct';
  url: string;
  label: string;
  quality?: string | null;
}

export interface WatchEpisode {
  id: string;
  title: string;
  order?: number;
  seasonId?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  duration?: number | string | null;
  videoSources: WatchVideoSource[];
  airDate?: Date | string | null;
  rating?: string | null;
}

export interface WatchSeason {
  id: string;
  seriesId: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  episodes: WatchEpisode[];
}

export interface WatchSeriesDetails {
  id: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  seasons?: WatchSeason[];
  episodes: WatchEpisode[];
}

export async function fetchSeriesWithEpisodes(
  seriesId: string
): Promise<WatchSeriesDetails> {
  const res = await api.series[seriesId].get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch series details'
    );
  }

  return res.data.data as unknown as WatchSeriesDetails;
}

export function getSeriesWithEpisodesQueryOptions(seriesId: string) {
  return queryOptions({
    queryKey: ['watch', 'series', seriesId],
    queryFn: () => fetchSeriesWithEpisodes(seriesId),
    enabled: Boolean(seriesId),
  });
}
