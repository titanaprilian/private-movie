import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  MediaSeriesDetails,
  MediaSeasonWithEpisodes,
  MediaEpisodeWithSources,
  MediaVideoSource,
} from '@repo/contracts';

export type WatchSeriesDetails = MediaSeriesDetails;
export type WatchSeason = MediaSeasonWithEpisodes;
export type WatchEpisode = MediaEpisodeWithSources;
export type WatchVideoSource = MediaVideoSource;

export type {
  MediaSeriesDetails,
  MediaSeasonWithEpisodes,
  MediaEpisodeWithSources,
  MediaVideoSource,
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

export async function fetchSeriesWithEpisodes(
  seriesId: string
): Promise<MediaSeriesDetails> {
  const res = await api.series[seriesId].get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch series details'));
  }

  return res.data.data as unknown as MediaSeriesDetails;
}

export function getSeriesWithEpisodesQueryOptions(seriesId: string) {
  return queryOptions({
    queryKey: ['watch', 'series', seriesId],
    queryFn: () => fetchSeriesWithEpisodes(seriesId),
    enabled: Boolean(seriesId),
  });
}
