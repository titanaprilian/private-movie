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
  createdAt: Date | string;
  updatedAt: Date | string;
  genreIds?: string[];
  genres?: Array<{ id: string; name: string; slug: string }> | string[];
  relations?: SeriesRelationItem[];
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
}

export async function fetchSeries(
  params?: FetchSeriesParams
): Promise<SeriesListResponse> {
  const rawQuery = {
    page: params?.page,
    limit: params?.limit,
    q: params?.q,
    genre: params?.genre,
    source: params?.source,
  };

  const query = Object.fromEntries(
    Object.entries(rawQuery).filter(([, value]) => value !== undefined)
  );

  const res = await api.series.get({
    $query: query as { page?: number; limit?: number; q?: string; genre?: string; source?: 'otakudesu' },
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

export async function mergeSeasons(
  seriesId: string,
  orderedSeasonIds: string[]
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[seriesId].seasons.merge.post({
    orderedSeasonIds,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to merge seasons'
    );
  }
}

export interface CreateSeasonParams {
  title: string;
  description?: string | null;
}

export async function createSeason(
  seriesId: string,
  params: CreateSeasonParams
): Promise<SeasonDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[seriesId].seasons.post(params);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to create season'
    );
  }

  return res.data.data as unknown as SeasonDetails;
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

export interface TmdbEpisodePreviewUpdateItem {
  id: string;
  order: number;
  existingTitle: string;
  newTitle: string;
  existingDescription: string | null;
  newDescription: string | null;
  existingThumbnailUrl: string | null;
  newThumbnailUrl: string | null;
  existingRating: string | null;
  newRating: string | null;
  existingAirDate: string | null;
  newAirDate: string | null;
  existingDuration: number | null;
  newDuration: number | null;
  tmdbId: number | null;
}

export interface TmdbEpisodePreviewInsertItem {
  order: number;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  rating: string | null;
  airDate: string | null;
  duration: number | null;
  tmdbId: number | null;
}

export interface TmdbEpisodePreviewUnmappedItem {
  id: string;
  order: number;
  title: string;
}

export interface SeasonTmdbPreviewResult {
  seasonId: string;
  tmdbId: number;
  tmdbSeason: number;
  updates: TmdbEpisodePreviewUpdateItem[];
  inserts: TmdbEpisodePreviewInsertItem[];
  unmapped: TmdbEpisodePreviewUnmappedItem[];
}

export interface SeasonTmdbSyncOptions {
  tmdbId?: number;
  tmdbSeason?: number;
}

export interface SeasonTmdbSyncResult {
  success: true;
  seasonId: string;
  updatedCount: number;
  insertedCount: number;
  unmappedCount: number;
}

export async function getSeasonTmdbPreview(
  seasonId: string,
  options?: SeasonTmdbSyncOptions
): Promise<SeasonTmdbPreviewResult> {
  const query: { tmdbId?: number; tmdbSeason?: number } = {};
  if (options?.tmdbId !== undefined) query.tmdbId = options.tmdbId;
  if (options?.tmdbSeason !== undefined) query.tmdbSeason = options.tmdbSeason;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.seasons as any)[seasonId].episodes['tmdb-preview'].get({
    $query: query,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch season TMDB preview'
    );
  }

  return res.data.data as unknown as SeasonTmdbPreviewResult;
}

export async function syncSeasonTmdb(
  seasonId: string,
  options?: SeasonTmdbSyncOptions
): Promise<SeasonTmdbSyncResult> {
  const body: { tmdbId?: number; tmdbSeason?: number } = {};
  if (options?.tmdbId !== undefined) body.tmdbId = options.tmdbId;
  if (options?.tmdbSeason !== undefined) body.tmdbSeason = options.tmdbSeason;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.seasons as any)[seasonId].episodes['tmdb-sync'].post(
    body
  );

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to sync season episodes with TMDB'
    );
  }

  return res.data.data as unknown as SeasonTmdbSyncResult;
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

export interface TmdbPreviewResult {
  title: string;
  overview: string;
  posterUrl: string | null;
}

export async function fetchSeriesTmdbPreview(
  type: 'tv' | 'movie',
  tmdbId: number
): Promise<TmdbPreviewResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)['tmdb']['tmdb-preview'].get({
    $query: { type, tmdbId },
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      (res.error?.value as { message?: string })?.message ||
        'Failed to fetch TMDB preview'
    );
  }

  return res.data.data as unknown as TmdbPreviewResult;
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
  onProgress?: (progress: {
    percent: number;
    loaded: number;
    total: number;
  }) => void;
  signal?: AbortSignal;
}

function getApiBaseUrl(): string {
  const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (typeof window !== 'undefined') {
    if (
      envApiUrl === 'http://localhost:3000' &&
      window.location.hostname !== 'localhost'
    ) {
      return window.location.origin;
    }
    if (envApiUrl) return envApiUrl;
    return window.location.origin;
  }
  return envApiUrl || 'http://localhost:3000';
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

      const { code, message } = parseUploadErrorPayload(xhr.responseText);
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

    xhr.send(form);
  });
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const chunk of parts) {
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

      if (!eventType || !eventDataStr) continue;

      let data: unknown;
      try {
        data = JSON.parse(eventDataStr);
      } catch {
        continue;
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
    }
  }

  if (!completedEpisode) {
    throw new Error('Ingest stream ended without completion event');
  }

  return completedEpisode;
}





