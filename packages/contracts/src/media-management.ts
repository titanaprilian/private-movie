/**
 * Administrative Media Management contracts for series, seasons, episodes,
 * video sources, scraping, TMDB synchronization, and uploads.
 */

import type { ScraperProvider } from "./scraper";

export interface AdminPaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface AdminVideoSourceItem {
  id: string;
  type: "embed" | "direct" | "s3";
  url: string;
  label: string;
  quality?: string | null;
  storageProviderId?: string | null;
}

export interface AdminEpisodeItem {
  id: string;
  sourceUrl?: string;
  source?: string;
  title: string;
  order?: number;
  videoType?: string | null;
  videoSources: AdminVideoSourceItem[];
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
  tmdbSeasonNumber?: number | null;
  tmdbEpisodeNumber?: number | null;
  isUnassigned?: boolean;
  thumbnailUrl?: string | null;
  rating?: string | null;
  airDate?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AdminSeasonItem {
  id: string;
  seriesId: string;
  sourceUrl?: string | null;
  source?: string | null;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  status?: "completed" | "ongoing" | "pending" | string | null;
  scraperUrl?: string | null;
  episodeOffset?: number;
  lastScrapedAt?: Date | string | null;
  lastScrapeError?: string | null;
  rating?: string | null;
  tmdbId?: number | null;
  tmdbSeason?: number | null;
  tmdbSyncStatus?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  episodes: AdminEpisodeItem[];
}

export interface AdminSeriesItemSeasonSummary {
  id: string;
  seriesId?: string;
  title?: string;
  status?: "completed" | "ongoing" | "pending" | string | null;
  seasonNumber?: number | null;
  [key: string]: unknown;
}

export interface AdminSeriesItem {
  id: string;
  sourceUrl: string;
  source: string;
  title: string;
  type?: "movie" | "tv" | null;
  description?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  logoUrl?: string | null;
  isFeatured?: boolean | null;
  isOngoingHighlighted?: boolean | null;
  hasOngoing?: boolean;
  tmdbId?: number | null;
  tmdbSyncStatus?: string | null;
  genreIds?: string[];
  genres?: Array<{ id: string; name: string; slug: string }> | string[];
  seasons?: AdminSeriesItemSeasonSummary[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AdminSeriesDetails extends Omit<AdminSeriesItem, "seasons"> {
  seasons?: AdminSeasonItem[];
  episodes: AdminEpisodeItem[];
}

// Series requests / responses
export interface AdminSeriesListQuery {
  page?: number;
  limit?: number;
  source?: ScraperProvider;
  q?: string;
  genre?: string;
  filter?: "all" | "featured" | "ongoing";
  highlighted?: boolean;
}

export interface AdminSeriesListResponseData {
  series: AdminSeriesItem[];
  meta: AdminPaginationMeta;
}

export interface AdminUpdateSeriesRequest {
  title?: string;
  description?: string | null;
  posterUrl?: string | null;
  logoUrl?: string | null;
  isFeatured?: boolean;
  isOngoingHighlighted?: boolean;
  genreIds?: string[];
}

// Season requests / responses
export interface AdminCreateSeasonRequest {
  title: string;
  seasonNumber: number;
  description?: string | null;
  posterUrl?: string | null;
  status?: "completed" | "ongoing" | "pending";
  scraperUrl?: string | null;
  source?: string | null;
  episodeOffset?: number;
}

export interface AdminUpdateSeasonRequest {
  title?: string;
  description?: string | null;
  posterUrl?: string | null;
  status?: string;
  scraperUrl?: string | null;
  source?: string | null;
  episodeOffset?: number;
}

export interface AdminScrapeOngoingSeasonResponseData {
  success: boolean;
  syncedEpisodesCount?: number;
  error?: string;
  [key: string]: unknown;
}

// Episode requests / responses
export interface AdminEpisodesListQuery {
  page?: number;
  limit?: number;
  seasonId?: string;
}

export interface AdminEpisodesListResponseData {
  episodes: AdminEpisodeItem[];
  meta: AdminPaginationMeta;
}

export interface AdminUpdateEpisodeRequest {
  title?: string;
  description?: string | null;
}

export interface AdminReorderEpisodesRequestItem {
  id: string;
  order: number;
  seasonId?: string;
}

// Video Sources requests
export interface AdminVideoSourceInput {
  type: "embed" | "direct" | "s3";
  url: string;
  label: string;
  quality?: string | null;
  storageProviderId?: string | null;
}

export interface AdminAddVideoSourcesRequest {
  videoSources: AdminVideoSourceInput[];
}

export interface AdminUpdateVideoSourceRequest {
  type?: "embed" | "direct" | "s3";
  url?: string;
  label?: string;
  quality?: string | null;
  storageProviderId?: string | null;
}

// Scraping Preview & Save
export interface AdminPreviewScrapeRequest {
  sourceUrl: string;
  source: ScraperProvider;
  html?: string;
}

export interface AdminPreviewScrapeEpisodeData {
  sourceUrl: string;
  source: ScraperProvider;
  title: string;
  videoType?: string | null;
  videoSources?: Array<{
    type: "embed" | "direct";
    url: string;
    label: string;
    quality?: string | null;
  }>;
  metadata?: Record<string, unknown>;
}

export interface AdminPreviewScrapeSeriesData {
  sourceUrl: string;
  source: ScraperProvider;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
}

export interface AdminPreviewScrapeResponseData {
  episode: AdminPreviewScrapeEpisodeData;
  series?: AdminPreviewScrapeSeriesData | null;
  [key: string]: unknown;
}

export interface AdminSaveMediaRequest {
  episode: AdminPreviewScrapeEpisodeData;
  series?: AdminPreviewScrapeSeriesData | null;
}

export interface AdminPreviewScrapeSeriesRequest {
  sourceUrl: string;
  source: ScraperProvider;
  html?: string;
}

// Bulk sources preview & save
export interface AdminPreviewBulkSourcesRequest {
  sourceUrl: string;
  source: ScraperProvider;
  episodeOffset?: number;
  seasonId?: string;
  html?: string;
}

export interface AdminBulkSourceItem {
  episodeOrder: number;
  episodeTitle: string;
  sourceUrl: string;
  matchedEpisodeId?: string | null;
  videoSources: Array<{
    label: string;
    url: string;
    quality?: string | null;
  }>;
}

export interface AdminPreviewBulkSourcesResponseData {
  seriesTitle?: string;
  sources: AdminBulkSourceItem[];
  [key: string]: unknown;
}

export interface AdminScrapeSourcesRequest {
  sourceUrl: string;
}

// TMDB preview, sync & import
export interface AdminTmdbPreviewQuery {
  type: "tv" | "movie";
  tmdbId: number;
  includeSpecials?: boolean;
}

export interface AdminTmdbImportRequest {
  type: "tv" | "movie";
  tmdbId: number;
  includeSpecials?: boolean;
}

export interface AdminTmdbSyncRequest {
  type: "tv" | "movie";
  tmdbId: number;
  includeSpecials?: boolean;
}

export interface AdminTmdbSyncPreviewQuery {
  type: "tv" | "movie";
  tmdbId: number;
  includeSpecials?: boolean;
}

export interface AdminTmdbPreviewSeasonItem {
  seasonNumber: number;
  name: string;
  overview?: string | null;
  posterPath?: string | null;
  airDate?: string | null;
  episodeCount: number;
}

export interface AdminTmdbPreviewResponseData {
  tmdbId: number;
  title: string;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  genres?: string[];
  type: "tv" | "movie";
  seasons?: AdminTmdbPreviewSeasonItem[];
  [key: string]: unknown;
}

// Presigned Upload
export interface AdminPresignUploadRequest {
  filename: string;
  contentType?: string | null;
  storageProviderId?: string;
}

export interface AdminPresignUploadResponseData {
  uploadUrl: string;
  key: string;
  uploadId?: string;
  storageProviderId?: string | null;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

export interface AdminUploadProgressResponseData {
  sessionId: string;
  progress: number;
  status: "idle" | "uploading" | "completed" | "error";
  error?: string;
  [key: string]: unknown;
}

// Bulk archive ingest (ZIP / RAR season packs)
export interface ArchiveIngestPreviewRequest {
  url: string;
  password?: string | null;
  referer?: string | null;
  targetSeasonId?: string | null;
}

export interface ArchiveStagedFileItem {
  fileId: string;
  filename: string;
  fileSizeBytes: number;
  detectedEpisodeNumber?: number | null;
  matchedEpisodeId?: string | null;
  quality?: string | null;
  needsReview: boolean;
}

export interface ArchiveIngestPreviewResponse {
  stagingSessionId: string;
  items: ArchiveStagedFileItem[];
}

export interface ArchiveIngestCommitItem {
  fileId: string;
  episodeId: string;
  label?: string | null;
  quality?: string | null;
  isIgnored?: boolean;
}

export interface ArchiveIngestCommitRequest {
  stagingSessionId: string;
  storageProviderId: string;
  defaultLabel?: string | null;
  items: ArchiveIngestCommitItem[];
}

export interface ArchiveIngestDownloadProgressPayload {
  loaded: number;
  total?: number | null;
  percent?: number | null;
}

export interface ArchiveIngestExtractProgressPayload {
  currentFile: string;
  totalFiles?: number | null;
}

export interface ArchiveIngestPreviewReadyPayload {
  stagingSessionId: string;
  items: ArchiveStagedFileItem[];
}

export interface ArchiveIngestUploadProgressPayload {
  fileIndex: number;
  totalFiles: number;
  filename: string;
  percent: number;
  loaded: number;
  total?: number | null;
}

export interface ArchiveIngestFileCompletedPayload {
  episodeId: string;
  videoSourceId: string;
}

export interface ArchiveIngestAllCompletedPayload {
  success: true;
  count: number;
}

export interface ArchiveIngestErrorPayload {
  code: string;
  message: string;
}

export type ArchiveIngestPreviewSseEvent =
  | { type: "download_progress"; data: ArchiveIngestDownloadProgressPayload }
  | { type: "extract_progress"; data: ArchiveIngestExtractProgressPayload }
  | { type: "preview_ready"; data: ArchiveIngestPreviewReadyPayload }
  | { type: "error"; data: ArchiveIngestErrorPayload };

export type ArchiveIngestCommitSseEvent =
  | { type: "upload_progress"; data: ArchiveIngestUploadProgressPayload }
  | { type: "file_completed"; data: ArchiveIngestFileCompletedPayload }
  | { type: "all_completed"; data: ArchiveIngestAllCompletedPayload }
  | { type: "error"; data: ArchiveIngestErrorPayload };

export type ArchiveIngestSseEvent =
  | ArchiveIngestPreviewSseEvent
  | ArchiveIngestCommitSseEvent;
