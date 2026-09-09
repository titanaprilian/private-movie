import { queryOptions } from '@tanstack/react-query';
import { api, getAccessToken } from '@/lib/api';
import { parseIngestUrl, type ParsedIngestUrl } from './parseIngestUrl';

export { parseIngestUrl };
export type { ParsedIngestUrl };

export interface VideoSource {
  id: string;
  type: 'embed' | 'direct' | 's3';
  url: string;
  label: string;
  quality?: string | null;
}

export interface VideoSourceInput {
  type: 'embed' | 'direct' | 's3';
  url: string;
  label: string;
  quality?: string | null;
}

export interface Episode {
  id: string;
  sourceUrl?: string;
  source?: string;
  title: string;
  order?: number;
  videoType?: string | null;
  videoSources: VideoSource[];
  description?: string | null;
  duration?: number | string | null;
  tags?: string[] | null;
  resolution?: string | null;
  format?: string | null;
  size?: string | null;
  metadata?: unknown;
  seriesId?: string | null;
  seasonId?: string | null;
  tmdbId?: number | null;
  thumbnailUrl?: string | null;
  rating?: string | null;
  airDate?: Date | string | null;
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

export interface SeriesRelationItem {
  relatedSeriesId: string;
  relationType: string;
  title?: string | null;
  posterUrl?: string | null;
}

export interface SeriesItem {
  id: string;
  sourceUrl: string;
  source: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  isFeatured?: boolean | null;
  hasOngoing?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  genreIds?: string[];
  genres?: Array<{ id: string; name: string; slug: string }> | string[];
  relations?: SeriesRelationItem[];
  seasons?: Array<{
    id: string;
    seriesId?: string;
    title?: string;
    status?: 'completed' | 'ongoing' | 'pending' | string | null;
    seasonNumber?: number | null;
    [key: string]: unknown;
  }>;
}

export interface SeriesListResponse {
  series: SeriesItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface SeasonDetails {
  id: string;
  seriesId: string;
  sourceUrl: string;
  source: string;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  status?: 'completed' | 'ongoing' | 'pending' | string | null;
  rating?: string | null;
  tmdbId?: number | null;
  tmdbSeason?: number | null;
  tmdbSyncStatus?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  episodes: Episode[];
}

export interface SeriesDetails {
  id: string;
  sourceUrl: string;
  source: string;
  title: string;
  type?: 'movie' | 'tv' | null;
  description?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  tmdbId?: number | null;
  tmdbSyncStatus?: string | null;
  isFeatured?: boolean | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  seasons?: SeasonDetails[];
  episodes: Episode[];
  relations?: SeriesRelationItem[];
  genres?: Array<{ id: string; name: string; slug: string }> | string[];
}

export interface FetchSeriesParams {
  page?: number;
  limit?: number;
  q?: string;
  genre?: string;
  source?: 'otakudesu' | 'dramula';
  filter?: 'all' | 'featured' | 'ongoing';
  tab?: 'all' | 'featured' | 'ongoing';
}

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
    },
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch series'
    );
  }

  return res.data.data as unknown as SeriesListResponse;
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
  source?: 'otakudesu' | 'dramula';
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

  return res.data.data as unknown as SeriesDetails;
}

export function seriesDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['series', id],
    queryFn: () => fetchSeriesDetail(id),
  });
}

export interface PreviewScrapeParams {
  sourceUrl: string;
  source: 'otakudesu' | 'dramula';
  html?: string;
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
    const errValue = res.error?.value as
      | {
          error?: {
            code?: string;
            message?: string;
            missingFields?: string[];
          };
          code?: string;
          message?: string;
          missingFields?: string[];
        }
      | undefined;

    const code = errValue?.error?.code || errValue?.code;
    const missingFields =
      errValue?.error?.missingFields || errValue?.missingFields;
    const message =
      errValue?.error?.message ||
      errValue?.message ||
      (res.error?.value as { message?: string })?.message ||
      'Failed to scrape preview';

    if (code === 'EPISODE_MISSING_FIELDS' || Array.isArray(missingFields)) {
      const err = new Error(message) as Error & {
        code: string;
        missingFields: string[];
      };
      err.code = 'EPISODE_MISSING_FIELDS';
      err.missingFields = Array.isArray(missingFields)
        ? missingFields
        : ['title', 'embedUrl'];
      throw err;
    }

    throw new Error(message);
  }

  return res.data.data as unknown as PreviewScrapeResult;
}

export interface PreviewScrapeSeriesResult {
  series: {
    sourceUrl: string;
    source: 'otakudesu' | 'dramula';
    title: string;
    description: string | null;
    posterUrl: string | null;
  };
  episodes: Array<{
    title: string;
    url: string;
    date: string | null;
  }>;
}

export async function previewScrapeSeries(
  params: PreviewScrapeParams
): Promise<PreviewScrapeSeriesResult> {
  const res = await api['preview-scrape-series'].post({
    sourceUrl: params.sourceUrl,
    source: params.source,
    html: params.html,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to scrape series preview'
    );
  }

  return res.data.data as unknown as PreviewScrapeSeriesResult;
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
      source: 'otakudesu' | 'dramula';
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
          source: params.series.source as 'otakudesu' | 'dramula',
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
  duration?: number | string | null;
  resolution?: string | null;
  format?: string | null;
  size?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown>;
}

export async function updateEpisode(id: string, data: UpdateEpisodeData): Promise<Episode> {
  const patchPayload: Record<string, unknown> = {};
  if (data.title !== undefined) patchPayload.title = data.title;
  if (data.description !== undefined) patchPayload.description = data.description;
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

  return res.data.data as unknown as Episode;
}

export interface ScrapeEpisodeSourcesParams {
  episodeId: string;
  sourceUrl: string;
}

export async function scrapeEpisodeSources(
  episodeIdOrParams: string | ScrapeEpisodeSourcesParams,
  sourceUrlParam?: string
): Promise<Episode> {
  const episodeId =
    typeof episodeIdOrParams === 'string'
      ? episodeIdOrParams
      : episodeIdOrParams.episodeId;
  const sourceUrl =
    typeof episodeIdOrParams === 'string'
      ? sourceUrlParam!
      : episodeIdOrParams.sourceUrl;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.episodes as any)[episodeId]['scrape-sources'].post({
    sourceUrl,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to deep scrape video sources'
    );
  }

  return res.data.data as unknown as Episode;
}

export interface AddVideoSourceInput {
  type: 'embed' | 'direct' | 's3';
  url: string;
  label: string;
  quality?: string | null;
}

export async function addVideoSource(
  episodeId: string,
  source: AddVideoSourceInput | AddVideoSourceInput[]
): Promise<Episode> {
  const videoSources = Array.isArray(source) ? source : [source];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  type?: 'embed' | 'direct' | 's3';
  url?: string;
  label?: string;
  quality?: string | null;
}

export async function updateVideoSource(
  episodeId: string,
  sourceId: string,
  updates: UpdateVideoSourceInput
): Promise<Episode> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  seasonId?: string;
}

export async function updateEpisodeOrders(
  seriesId: string,
  orders: ReorderEpisodeItem[]
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[seriesId].episodes.order.patch(orders);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to reorder episodes'
    );
  }
}

export interface UpdateSeriesParams {
  title?: string;
  description?: string | null;
  posterUrl?: string | null;
  genreIds?: string[];
  relations?: { relatedSeriesId: string; relationType: string }[];
  isFeatured?: boolean;
}

export async function updateSeries(
  id: string,
  updates: UpdateSeriesParams
): Promise<SeriesItem> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[id].patch(updates);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to update series'
    );
  }

  return res.data.data as SeriesItem;
}

export async function deleteSeries(id: string): Promise<SeriesItem> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[id].delete();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to delete series'
    );
  }

  return res.data.data as SeriesItem;
}

export interface UpdateSeasonParams {
  title?: string;
  description?: string | null;
  status?: 'completed' | 'ongoing' | 'pending';
}

export async function updateSeason(
  seasonId: string,
  params: UpdateSeasonParams
): Promise<SeasonDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.seasons as any)[seasonId].patch(params);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to update season'
    );
  }

  return res.data.data as unknown as SeasonDetails;
}

export async function deleteSeason(seasonId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.seasons as any)[seasonId].delete();

  if (res.error) {
    const errorValue = res.error.value as
      | { code?: string; message?: string; error?: { code?: string; message?: string } }
      | undefined;
    const code = errorValue?.error?.code || errorValue?.code;
    const message =
      errorValue?.error?.message ||
      errorValue?.message ||
      'Failed to delete season';
    const error = new Error(message) as Error & { code?: string };
    error.code = code;
    throw error;
  }
}

export interface PreviewBulkSourcesParams {
  seriesId: string;
  sourceUrl: string;
  source?: 'otakudesu' | 'dramula';
  episodeOffset?: number;
  seasonId?: string;
}

export interface ScrapedBulkEpisodeItem {
  scrapedTitle: string;
  scrapedUrl: string;
  episodeNumber: number | null;
  calculatedOrder: number | null;
  matchedLocalEpisodeId: string | null;
  matchStatus: 'matched' | 'unmatched';
}

export interface BulkPreviewLocalEpisodeItem {
  id: string;
  title: string;
  order: number;
  seasonId: string;
  seasonNumber: number | null;
  seasonTitle: string;
  hasSources: boolean;
}

export interface PreviewBulkSourcesResult {
  scrapedEpisodes: ScrapedBulkEpisodeItem[];
  localEpisodes: BulkPreviewLocalEpisodeItem[];
}

export async function previewBulkSources(
  params: PreviewBulkSourcesParams
): Promise<PreviewBulkSourcesResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[params.seriesId]['preview-bulk-sources'].post({
    sourceUrl: params.sourceUrl,
    source: params.source ?? 'otakudesu',
    episodeOffset: params.episodeOffset,
    seasonId: params.seasonId,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch bulk scrape preview'
    );
  }

  return res.data.data as unknown as PreviewBulkSourcesResult;
}

export interface SaveBulkSourcesMappingItem {
  episodeId: string | null;
  videoSources: {
    type: 'embed' | 'direct';
    url: string;
    label: string;
    quality?: string | null;
  }[];
}

export interface SaveBulkSourcesParams {
  seriesId: string;
  mappings: SaveBulkSourcesMappingItem[];
}

export interface SaveBulkSourcesResult {
  success: boolean;
  savedCount: number;
  skippedCount: number;
}

export async function saveBulkSources(
  params: SaveBulkSourcesParams
): Promise<SaveBulkSourcesResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[params.seriesId]['bulk-sources'].post({
    mappings: params.mappings,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to save bulk sources'
    );
  }

  return res.data.data as unknown as SaveBulkSourcesResult;
}

export interface ImportTmdbParams {
  type: 'tv' | 'movie';
  tmdbId: number;
  includeSpecials?: boolean;
}

export interface SyncTmdbParams {
  type: 'tv' | 'movie';
  tmdbId: number;
  includeSpecials?: boolean;
}

export async function syncSeriesTmdb(
  seriesId: string,
  params: SyncTmdbParams
): Promise<SeriesDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[seriesId]['tmdb-sync'].post(params);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to sync series with TMDB'
    );
  }

  return res.data.data as unknown as SeriesDetails;
}

export async function importTmdb(
  params: ImportTmdbParams
): Promise<SeriesDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)['tmdb-import'].post(params);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to import TMDB series'
    );
  }

  return res.data.data as unknown as SeriesDetails;
}

export interface TmdbPreviewSeason {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterUrl: string | null;
}

export interface TmdbPreviewResult {
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl?: string | null;
  releaseDate?: string | null;
  genres?: string[];
  totalSeasons?: number;
  totalEpisodes?: number;
  status?: string | null;
  seasons?: TmdbPreviewSeason[];
  runtime?: number | null;
}

export async function fetchSeriesTmdbPreview(
  type: 'tv' | 'movie',
  tmdbId: number,
  includeSpecials?: boolean
): Promise<TmdbPreviewResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)['tmdb-preview'].get({
    $query: { type, tmdbId, includeSpecials },
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch TMDB preview'
    );
  }

  return res.data.data as unknown as TmdbPreviewResult;
}

export interface FetchSeriesTmdbSyncPreviewParams {
  type: 'tv' | 'movie';
  tmdbId: number;
  includeSpecials?: boolean;
}

export interface EpisodeChangeItem {
  seasonNumber: number;
  episodeNumber: number;
  oldTitle: string;
  newTitle: string;
  oldOverview: string | null;
  newOverview: string | null;
  oldThumbnailUrl: string | null;
  newThumbnailUrl: string | null;
  oldAirDate: string | null;
  newAirDate: string | null;
  titleChanged: boolean;
  overviewChanged: boolean;
  thumbnailChanged: boolean;
  airDateChanged: boolean;
}

export interface SeasonSyncDiffItem {
  seasonNumber: number;
  name: string;
  incomingEpisodeCount: number;
  localEpisodeCount: number;
  diff: number;
  isNewSeason: boolean;
  badgeText: string;
  badgeType: 'existing' | 'new-eps' | 'new-season';
}

export interface TmdbSyncPreviewResult {
  seriesId: string;
  seriesUpdated: boolean;
  series: {
    title: string;
    overview: string | null;
    posterUrl: string | null;
    backdropUrl: string | null;
    rating: string | null;
    releaseDate: string | null;
    genres: string[];
    status?: string | null;
  };
  totalNewEpisodes: number;
  totalNewSeasons: number;
  totalUpdatedEpisodes: number;
  seasonDiffs: SeasonSyncDiffItem[];
  episodeChanges: EpisodeChangeItem[];
}

export async function fetchSeriesTmdbSyncPreview(
  seriesId: string,
  params: FetchSeriesTmdbSyncPreviewParams
): Promise<TmdbSyncPreviewResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[seriesId]['tmdb-sync-preview'].get({
    $query: params,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch TMDB sync preview'
    );
  }

  return res.data.data as unknown as TmdbSyncPreviewResult;
}

export interface PresignUploadSourceParams {
  filename: string;
  contentType?: string;
}

export interface PresignUploadSourceResult {
  uploadUrl: string;
  key: string;
}

export async function presignUploadSource(
  episodeId: string,
  params: PresignUploadSourceParams
): Promise<PresignUploadSourceResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.episodes as any)[episodeId].sources['presign-upload'].post(params);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    const errorVal = res.error?.value as { error?: { code?: string; message?: string }; code?: string; message?: string } | undefined;
    const code = errorVal?.error?.code || errorVal?.code;
    const message = errorVal?.error?.message || errorVal?.message || (res.error?.value as { message?: string })?.message || 'Failed to request presigned upload URL';
    const err = new Error(message) as Error & { code?: string };
    if (code) err.code = code;
    throw err;
  }

  return res.data.data as PresignUploadSourceResult;
}

export interface UploadEpisodeVideoSourceOptions {
  file: File;
  label: string;
  quality?: string;
  uploadSessionId?: string;
  onProgress?: (progress: {
    percent: number;
    loaded: number;
    total: number;
  }) => void;
  signal?: AbortSignal;
}

function getApiBaseUrl(): string {
  const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  let base: string;
  if (typeof window !== 'undefined') {
    if (
      envApiUrl === 'http://localhost:3000' &&
      window.location.hostname !== 'localhost'
    ) {
      base = window.location.origin;
    } else if (envApiUrl) {
      base = envApiUrl;
    } else {
      base = window.location.origin;
    }
  } else {
    base = envApiUrl || 'http://localhost:3000';
  }
  return base.replace(/\/api\/?$/, '');
}

export function getMaxUploadSizeMb(): number {
  const envVal = import.meta.env.VITE_MAX_UPLOAD_SIZE_MB as string | undefined;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1024;
}

export function getMaxUploadSizeBytes(): number {
  return getMaxUploadSizeMb() * 1024 * 1024;
}

function parseUploadErrorPayload(raw: string): { code?: string; message?: string } {
  try {
    const json = JSON.parse(raw) as {
      error?: { code?: string; message?: string };
      code?: string;
      message?: string;
    };
    return {
      code: json?.error?.code || json?.code,
      message: json?.error?.message || json?.message,
    };
  } catch {
    return {};
  }
}

/**
 * Upload a video file through the backend proxy endpoint
 * `POST /api/episodes/:id/sources/upload` (multipart/form-data).
 * The backend streams the file to S3/B2 and registers the `s3` source,
 * so the browser never talks to B2 directly (no CORS preflight).
 */
export function uploadEpisodeVideoSource(
  episodeId: string,
  options: UploadEpisodeVideoSourceOptions
): Promise<Episode> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${getApiBaseUrl()}/api/episodes/${encodeURIComponent(
      episodeId
    )}/sources/upload`;
    xhr.open('POST', url);
    xhr.withCredentials = true;

    const token = getAccessToken();
    if (token) {
      xhr.setRequestHeader('authorization', `Bearer ${token}`);
    }
    // Note: do NOT set Content-Type manually — the browser sets the
    // multipart/form-data boundary automatically.

    const { signal, onProgress } = options;

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          xhr.abort();
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true }
      );
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress({ percent, loaded: event.loaded, total: event.total });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as {
            data?: unknown;
          };
          if (json && 'data' in json && json.data) {
            resolve(json.data as Episode);
          } else {
            reject(new Error('Failed to upload video source'));
          }
        } catch {
          reject(new Error('Failed to upload video source'));
        }
        return;
      }

      let { code, message } = parseUploadErrorPayload(xhr.responseText);

      if (xhr.status === 413) {
        if (!code) {
          code = 'FILE_TOO_LARGE';
        }
        if (!message) {
          const maxMb = getMaxUploadSizeMb();
          const maxGb = maxMb >= 1024 && maxMb % 1024 === 0 ? `${maxMb / 1024} GB` : `${maxMb} MB`;
          message = `File size exceeds the maximum allowed limit of ${maxGb}`;
        }
      }

      const err = new Error(
        message || `Failed to upload video source (status ${xhr.status})`
      ) as Error & { code?: string; status?: number };
      if (code) err.code = code;
      err.status = xhr.status;
      reject(err);
    };

    xhr.onerror = () => {
      reject(new Error('Network error during video upload'));
    };

    xhr.onabort = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const form = new FormData();
    form.append('file', options.file, options.file.name);
    form.append('label', options.label);
    if (options.quality) {
      form.append('quality', options.quality);
    }
    if (options.uploadSessionId) {
      form.append('uploadSessionId', options.uploadSessionId);
    }

    xhr.send(form);
  });
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export async function getUploadProgress(sessionId: string): Promise<UploadProgress> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.episodes as any)['upload-progress'][sessionId].get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Upload session not found'
    );
  }

  return res.data.data as UploadProgress;
}

export interface UploadBinaryOptions {
  url: string;
  file: File;
  onProgress?: (progress: { percent: number; loaded: number; total: number }) => void;
  signal?: AbortSignal;
}

export function uploadBinaryToS3({
  url,
  file,
  onProgress,
  signal,
}: UploadBinaryOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    // Note: Do not set unnecessary custom headers to avoid S3 SignatureDoesNotMatch or CORS preflight blocks
    if (file.type) {
      xhr.setRequestHeader('Content-Type', file.type);
    }

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress({ percent, loaded: event.loaded, total: event.total });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during S3 upload'));
    };

    xhr.onabort = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };

    xhr.send(file);
  });
}

export interface RemoteIngestEpisodeVideoSourceOptions {
  url: string;
  label: string;
  quality?: string | null;
  referer?: string | null;
  onProgress?: (progress: {
    percent: number;
    loaded: number;
    total: number;
  }) => void;
  signal?: AbortSignal;
}

export async function remoteIngestEpisodeVideoSource(
  episodeId: string,
  options: RemoteIngestEpisodeVideoSourceOptions
): Promise<Episode> {
  const apiUrl = `${getApiBaseUrl()}/api/episodes/${encodeURIComponent(
    episodeId
  )}/sources/remote-ingest`;
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: options.url,
      label: options.label,
      quality: options.quality || undefined,
      referer: options.referer || undefined,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    let errorCode: string | undefined;
    let errorMessage = `Failed to ingest remote video (status ${response.status})`;
    try {
      const json = await response.json();
      if (json?.error) {
        errorCode = json.error.code;
        errorMessage = json.error.message || errorMessage;
      }
    } catch {
      // ignore JSON parse error
    }
    const err = new Error(errorMessage) as Error & {
      code?: string;
      status?: number;
    };
    if (errorCode) err.code = errorCode;
    err.status = response.status;
    throw err;
  }

  if (!response.body) {
    throw new Error('No response body received for remote ingest stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completedEpisode: Episode | null = null;

  const parseSSEChunk = (chunk: string) => {
    const lines = chunk.split('\n');
    let eventType = '';
    let eventDataStr = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        eventDataStr = line.slice(6).trim();
      }
    }

    if (!eventType || !eventDataStr) return;

    let data: unknown;
    try {
      data = JSON.parse(eventDataStr);
    } catch {
      return;
    }

    if (eventType === 'progress' && typeof data === 'object' && data !== null) {
      const progressData = data as { percent?: number; loaded?: number; total?: number };
      options.onProgress?.({
        percent: progressData.percent ?? 0,
        loaded: progressData.loaded ?? 0,
        total: progressData.total ?? 0,
      });
    } else if (eventType === 'complete' && typeof data === 'object' && data !== null) {
      const completeData = data as { episode?: Episode };
      if (completeData.episode) {
        completedEpisode = completeData.episode;
      }
    } else if (eventType === 'error' && typeof data === 'object' && data !== null) {
      const errorData = data as { code?: string; message?: string };
      const err = new Error(errorData.message || 'Remote ingest failed') as Error & { code?: string };
      if (errorData.code) err.code = errorData.code;
      throw err;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n+/);
    buffer = parts.pop() ?? '';

    for (const chunk of parts) {
      parseSSEChunk(chunk);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const chunks = buffer.split(/\n\n+/);
    for (const chunk of chunks) {
      if (chunk.trim()) {
        parseSSEChunk(chunk);
      }
    }
  }

  if (!completedEpisode) {
    throw new Error('Ingest stream ended without completion event');
  }

  return completedEpisode;
}

export interface CheckVideoSourceInput {
  url: string;
  type: 'direct' | 'embed' | 's3';
  referer?: string | null;
}

export interface CheckVideoSourceResult {
  status: 'working' | 'broken';
  statusCode?: number | null;
  latencyMs?: number | null;
  error?: string | null;
}

export async function checkVideoSource(
  input: CheckVideoSourceInput
): Promise<CheckVideoSourceResult> {
  const apiUrl = `${getApiBaseUrl()}/api/media/sources/check`;
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: input.url,
      type: input.type,
      referer: input.referer || undefined,
    }),
  });

  if (!response.ok) {
    let message = `Health check failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        message = errJson.error.message;
      }
    } catch {
      // ignore
    }
    return {
      status: 'broken',
      statusCode: response.status,
      error: message,
    };
  }

  const json = await response.json();
  const data = json?.data;
  return {
    status: data?.status ?? 'broken',
    statusCode: data?.statusCode ?? response.status,
    latencyMs: data?.latencyMs,
    error: data?.error ?? null,
  };
}






