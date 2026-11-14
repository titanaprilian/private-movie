import { api, extractErrorMessage } from '@/lib/api';
import type {
  Episode,
  FetchSeriesTmdbSyncPreviewParams,
  ImportTmdbParams,
  PreviewScrapeParams,
  SyncTmdbParams,
  SeriesDetails,
  SaveMediaParams,
  VideoSourceInput,
} from './types';

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
    const message = extractErrorMessage(res.error, 'Failed to scrape preview');

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

  return res.data.data as PreviewScrapeResult;
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
      extractErrorMessage(res.error, 'Failed to scrape series preview')
    );
  }

  return res.data.data as PreviewScrapeSeriesResult;
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
          description: params.series.description ?? null,
          posterUrl: params.series.posterUrl ?? null,
        }
      : undefined,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to save media'));
  }

  return res.data.data as SaveMediaResult;
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
      extractErrorMessage(res.error, 'Failed to deep scrape video sources')
    );
  }

  return res.data.data as Episode;
}

export interface ScrapeOngoingSeasonResult {
  seasonId: string;
  seriesId: string;
  success: boolean;
  tmdbSynced: boolean;
  episodesScraped: number;
  sourcesSaved: number;
  seasonCompleted: boolean;
  error?: string | null;
}

export async function scrapeOngoingSeason(
  seasonId: string
): Promise<ScrapeOngoingSeasonResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.seasons as any)[seasonId]['scrape-ongoing'].post();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to auto-scrape ongoing season')
    );
  }

  return res.data.data as ScrapeOngoingSeasonResult;
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
  const res = await (api.series as any)[params.seriesId][
    'preview-bulk-sources'
  ].post({
    sourceUrl: params.sourceUrl,
    source: params.source ?? 'otakudesu',
    episodeOffset: params.episodeOffset,
    seasonId: params.seasonId,
  });

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to fetch bulk scrape preview')
    );
  }

  return res.data.data as PreviewBulkSourcesResult;
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
      extractErrorMessage(res.error, 'Failed to save bulk sources')
    );
  }

  return res.data.data as SaveBulkSourcesResult;
}

export async function syncSeriesTmdb(
  seriesId: string,
  params: SyncTmdbParams
): Promise<SeriesDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.series as any)[seriesId]['tmdb-sync'].post(params);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to sync series with TMDB')
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
      extractErrorMessage(res.error, 'Failed to import TMDB series')
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
      extractErrorMessage(res.error, 'Failed to fetch TMDB preview')
    );
  }

  return res.data.data as TmdbPreviewResult;
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
      extractErrorMessage(res.error, 'Failed to fetch TMDB sync preview')
    );
  }

  return res.data.data as TmdbSyncPreviewResult;
}
