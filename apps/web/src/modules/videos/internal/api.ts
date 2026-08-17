import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface VideoSource {
  id: string;
  type: 'embed' | 'direct';
  url: string;
  label: string;
  quality?: string | null;
}

export interface VideoSourceInput {
  type: 'embed' | 'direct';
  url: string;
  label: string;
  quality?: string | null;
}

export interface Episode {
  id: string;
  sourceUrl: string;
  source: string;
  title: string;
  order?: number;
  videoType?: string | null;
  videoSources: VideoSource[];
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

export interface SeriesItem {
  id: string;
  sourceUrl: string;
  source: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SeriesListResponse {
  series: SeriesItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface SeriesDetails {
  id: string;
  sourceUrl: string;
  source: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  episodes: Episode[];
}

export interface FetchSeriesParams {
  page?: number;
  limit?: number;
  source?: 'otakudesu';
}

export async function fetchSeries(
  params?: FetchSeriesParams
): Promise<SeriesListResponse> {
  const rawQuery = {
    page: params?.page,
    limit: params?.limit,
    source: params?.source,
  };

  const query = Object.fromEntries(
    Object.entries(rawQuery).filter(([, value]) => value !== undefined)
  );

  const res = await api.series.get({
    $query: query as { page?: number; limit?: number; source?: 'otakudesu' },
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch series'
    );
  }

  return res.data.data as SeriesListResponse;
}

export function seriesListQueryOptions(params?: FetchSeriesParams) {
  return queryOptions({
    queryKey: ['series', 'list', params],
    queryFn: () => fetchSeries(params),
  });
}

export interface FetchEpisodesParams {
  page?: number;
  limit?: number;
  source?: 'otakudesu';
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

export async function fetchEpisode(id: string): Promise<Episode> {
  const res = await api.episodes[id].get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch episode'
    );
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
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch series details'
    );
  }

  return res.data.data as SeriesDetails;
}

export function seriesDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['series', id],
    queryFn: () => fetchSeriesDetail(id),
  });
}

export interface PreviewScrapeParams {
  sourceUrl: string;
  source: 'otakudesu';
  html: string;
}

export interface PreviewScrapeResult {
  episode: {
    sourceUrl: string;
    source: string;
    title: string;
    videoType: string | null;
    videoSources: VideoSourceInput[];
    metadata: Record<string, unknown>;
  };
  series: {
    sourceUrl: string;
    source: string;
    title: string;
    description: string | null;
    posterUrl: string | null;
  } | null;
  warnings: string[];
}

export async function previewScrape(
  params: PreviewScrapeParams
): Promise<PreviewScrapeResult> {
  const res = await api['preview-scrape'].post({
    sourceUrl: params.sourceUrl,
    source: params.source,
    html: params.html,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to scrape preview'
    );
  }

  return res.data.data as unknown as PreviewScrapeResult;
}

export interface SaveMediaParams {
  episode: {
    sourceUrl: string;
    source: 'otakudesu' | string;
    title: string;
    videoType: string | null;
    videoSources?: VideoSourceInput[];
    metadata: Record<string, unknown>;
  };
  series?: {
    sourceUrl: string;
    source: 'otakudesu' | string;
    title: string;
    description: string | null;
    posterUrl: string | null;
  } | null;
}

export interface SaveMediaResult {
  episode: Episode;
  series: SeriesDetails | null;
}

export async function saveMedia(
  params: SaveMediaParams
): Promise<SaveMediaResult> {
  const res = await api['save-media'].post({
    episode: params.episode as {
      sourceUrl: string;
      source: 'otakudesu';
      title: string;
      videoType: string | null;
      videoSources?: Array<{
        type: 'embed' | 'direct';
        url: string;
        label: string;
        quality?: string | null;
      }>;
      metadata: Record<string, unknown>;
    },
    series: params.series
      ? {
          sourceUrl: params.series.sourceUrl,
          source: params.series.source as 'otakudesu',
          title: params.series.title,
          description: params.series.description,
          posterUrl: params.series.posterUrl,
        }
      : undefined,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to save media'
    );
  }

  return res.data.data as unknown as SaveMediaResult;
}

export interface UpdateEpisodeData {
  title?: string;
  videoType?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export async function updateEpisode(id: string, data: UpdateEpisodeData): Promise<Episode> {
  const res = await api.episodes[id].patch(data);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to update episode'
    );
  }

  return res.data.data as Episode;
}

export async function deleteEpisode(id: string): Promise<Episode> {
  const res = await api.episodes[id].delete();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to delete episode'
    );
  }

  return res.data.data as Episode;
}

export async function resolveEpisode(id: string): Promise<Episode> {
  const res = await (api.episodes as any)[id].resolve.post();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to resolve episode stream'
    );
  }

  return res.data.data as Episode;
}

export interface AddVideoSourceInput {
  type: 'embed' | 'direct';
  url: string;
  label: string;
  quality?: string | null;
}

export async function addVideoSource(
  episodeId: string,
  source: AddVideoSourceInput | AddVideoSourceInput[]
): Promise<Episode> {
  const videoSources = Array.isArray(source) ? source : [source];
  const res = await (api.episodes as any)[episodeId].sources.post({
    videoSources,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to add video source'
    );
  }

  return res.data.data as unknown as Episode;
}

export const addVideoSources = addVideoSource;

export interface UpdateVideoSourceInput {
  type?: 'embed' | 'direct';
  url?: string;
  label?: string;
  quality?: string | null;
}

export async function updateVideoSource(
  episodeId: string,
  sourceId: string,
  updates: UpdateVideoSourceInput
): Promise<Episode> {
  const res = await (api.episodes as any)[episodeId].sources[sourceId].patch(
    updates
  );

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to update video source'
    );
  }

  return res.data.data as unknown as Episode;
}

export async function deleteVideoSource(
  episodeId: string,
  sourceId: string
): Promise<Episode> {
  const res = await (api.episodes as any)[episodeId].sources[sourceId].delete();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to delete video source'
    );
  }

  return res.data.data as unknown as Episode;
}

export interface ReorderEpisodeItem {
  id: string;
  order: number;
}

export async function updateEpisodeOrders(
  seriesId: string,
  orders: ReorderEpisodeItem[]
): Promise<void> {
  const res = await (api.series as any)[seriesId].episodes.order.patch(orders);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to reorder episodes'
    );
  }
}


