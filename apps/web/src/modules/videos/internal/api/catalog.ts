import { queryOptions } from '@tanstack/react-query';
import { api, extractErrorMessage } from '@/lib/api';
import type {
  Episode,
  EpisodesListResponse,
  FetchEpisodesParams,
  FetchSeriesParams,
  SeasonDetails,
  SeriesDetails,
  SeriesItem,
  SeriesListResponse,
  ReorderEpisodeItem,
  UpdateSeriesParams,
  UpdateSeasonParams,
  CreateSeasonParams,
} from './types';

export async function fetchSeries(
  params?: FetchSeriesParams
): Promise<SeriesListResponse> {
  const filter = params?.filter ?? params?.tab;
  const rawQuery = {
    page: params?.page,
    limit: params?.limit,
    q: params?.q,
    genre: params?.genre,
    source: params?.source,
    filter: filter && filter !== 'all' ? filter : undefined,
    highlighted: params?.highlighted,
  };

  const query = Object.fromEntries(
    Object.entries(rawQuery).filter(([, value]) => value !== undefined)
  );

  const res = await api.series.get({
    $query: query as {
      page?: number;
      limit?: number;
      q?: string;
      genre?: string;
      source?: 'otakudesu';
      filter?: 'all' | 'featured' | 'ongoing';
      highlighted?: boolean;
    },
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch series'));
  }

  return res.data.data as unknown as SeriesListResponse;
}

export function seriesListQueryOptions(params?: FetchSeriesParams) {
  return queryOptions({
    queryKey: ['series', 'list', params],
    queryFn: () => fetchSeries(params),
  });
}

export async function fetchEpisodes(
  params?: FetchEpisodesParams
): Promise<EpisodesListResponse> {
  const rawQuery = {
    page: params?.page,
    limit: params?.limit,
    source: params?.source,
  };

  const query = Object.fromEntries(
    Object.entries(rawQuery).filter(([, value]) => value !== undefined)
  );

  const res = await api.episodes.get({
    $query: query as { page?: number; limit?: number; source?: 'otakudesu' },
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch episodes'));
  }

  return res.data.data as EpisodesListResponse;
}

export function episodesQueryOptions(params?: FetchEpisodesParams) {
  return queryOptions({
    queryKey: ['episodes', params],
    queryFn: () => fetchEpisodes(params),
  });
}

export async function fetchEpisode(id: string): Promise<Episode> {
  const res = await api.episodes[id].get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch episode'));
  }

  return res.data.data as unknown as Episode;
}

export function episodeQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['episodes', id],
    queryFn: () => fetchEpisode(id),
  });
}

export async function fetchSeriesDetail(id: string): Promise<SeriesDetails> {
  const res = await api.series[id].get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to fetch series details')
    );
  }

  return res.data.data as unknown as SeriesDetails;
}

export function seriesDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['series', id],
    queryFn: () => fetchSeriesDetail(id),
  });
}

export interface UpdateEpisodeData {
  title?: string;
  videoType?: string | null;
  description?: string | null;
  duration?: number | string | null;
  resolution?: string | null;
  format?: string | null;
  size?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown>;
}

export async function updateEpisode(
  id: string,
  data: UpdateEpisodeData
): Promise<Episode> {
  const patchPayload: Record<string, unknown> = {};
  if (data.title !== undefined) patchPayload.title = data.title;
  if (data.description !== undefined)
    patchPayload.description = data.description;
  if (data.videoType !== undefined) patchPayload.videoType = data.videoType;
  if (data.duration !== undefined) patchPayload.duration = data.duration;
  if (data.resolution !== undefined) patchPayload.resolution = data.resolution;
  if (data.format !== undefined) patchPayload.format = data.format;
  if (data.size !== undefined) patchPayload.size = data.size;
  if (data.tags !== undefined) patchPayload.tags = data.tags;
  if (data.metadata !== undefined) patchPayload.metadata = data.metadata;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.episodes as any)[id].patch(patchPayload);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to update episode'));
  }

  return res.data.data as Episode;
}

export async function deleteEpisode(id: string): Promise<Episode> {
  const res = await api.episodes[id].delete();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to delete episode'));
  }

  return res.data.data as Episode;
}

export async function updateEpisodeOrders(
  seriesId: string,
  orders: ReorderEpisodeItem[]
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[seriesId].episodes.order.patch(orders);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to reorder episodes')
    );
  }
}

export async function updateSeries(
  id: string,
  updates: UpdateSeriesParams
): Promise<SeriesItem> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[id].patch(updates);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to update series'));
  }

  return res.data.data as SeriesItem;
}

export async function deleteSeries(id: string): Promise<SeriesItem> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[id].delete();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to delete series'));
  }

  return res.data.data as SeriesItem;
}

export async function updateSeason(
  seasonId: string,
  params: UpdateSeasonParams
): Promise<SeasonDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.seasons as any)[seasonId].patch(params);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to update season'));
  }

  return res.data.data as unknown as SeasonDetails;
}

export async function createSeason(
  seriesId: string,
  params: CreateSeasonParams
): Promise<SeasonDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[seriesId].seasons.post(params);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to create season'));
  }

  return res.data.data as unknown as SeasonDetails;
}

export async function deleteSeason(seasonId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.seasons as any)[seasonId].delete();

  if (res.error) {
    const errorValue = res.error.value as
      | {
          code?: string;
          message?: string;
          error?: { code?: string; message?: string };
        }
      | undefined;
    const code = errorValue?.error?.code || errorValue?.code;
    const message = extractErrorMessage(res.error, 'Failed to delete season');
    const error = new Error(message) as Error & { code?: string };
    error.code = code;
    throw error;
  }
}
