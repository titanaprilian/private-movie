import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Episode {
  id: string;
  sourceUrl: string;
  source: string;
  title: string;
  videoType?: string | null;
  videoUrl: string;
  description?: string | null;
  duration?: string | null;
  tags?: string[] | null;
  resolution?: string | null;
  format?: string | null;
  size?: string | null;
  metadata?: unknown;
  seriesId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface EpisodesListResponse {
  episodes: Episode[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface FetchEpisodesParams {
  page?: number;
  limit?: number;
  source?: 'otakudesu';
}

export async function fetchEpisodes(
  params?: FetchEpisodesParams
): Promise<EpisodesListResponse> {
  const res = await api.episodes.get({
    $query: {
      page: params?.page,
      limit: params?.limit,
      source: params?.source,
    },
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch episodes'
    );
  }

  return res.data.data as EpisodesListResponse;
}

export function episodesQueryOptions(params?: FetchEpisodesParams) {
  return queryOptions({
    queryKey: ['episodes', params],
    queryFn: () => fetchEpisodes(params),
  });
}
