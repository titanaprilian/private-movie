import type * as React from 'react';
import type { ArchiveIngestJobStatus } from '@repo/contracts';
import type { SeriesDetails } from '../api';

export type { SeriesDetails };
export type { ParsedIngestUrl } from './parseIngestUrl';

// ─── Shared domain entities ─────────────────────────────────────────────────

export interface SeasonGroupOption {
  id: string;
  title?: string | null;
  tmdbSeason?: number | null;
  episodes?: Array<{
    id: string;
    title: string;
    order?: number;
    hasSources?: boolean;
    videoSources?: unknown[];
  }>;
}

export interface LocalEpisodeItem {
  id: string;
  title: string;
  order?: number;
  seasonId?: string | null;
  seasonTitle?: string;
  seasonNumber?: number;
  hasSources?: boolean;
  videoSources?: unknown[];
}

export interface ScrapedEpisodePreviewItem {
  id: string;
  scrapedTitle: string;
  rawEpisodeNumber: number | string;
  calculatedOrder: number | null;
  matchedLocalEpisodeId: string | null;
  isIgnored: boolean;
  needsReview: boolean;
  videoSources: {
    type: string;
    url: string;
    label: string;
    quality?: string;
  }[];
}

export interface ProcessingLogItem {
  id: string;
  scrapedTitle: string;
  rawEpisodeNumber: number | string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  message: string;
}

export interface BulkIngestItem {
  id: string;
  url: string;
  filename: string;
  detectedEpisodeNumber: number | null;
  matchedLocalEpisodeId: string | null;
  label: string;
  quality: string | null;
  isIgnored: boolean;
  needsReview: boolean;
  status: 'pending' | 'ingesting' | 'completed' | 'failed' | 'skipped';
  progress?: {
    percent: number;
    loaded: number;
    total: number;
  };
  errorMessage?: string;
}

export interface ArchiveReviewItem {
  /** filename acts as the stable id in the job model */
  fileId: string;
  filename: string;
  fileSizeBytes: number;
  detectedEpisodeNumber: number | null;
  matchedEpisodeId: string | null;
  quality: string | null;
  needsReview: boolean;
  isIgnored: boolean;
  label: string;
  /** Commit-phase status (derived from job status for compat) */
  commitStatus: 'pending' | 'uploading' | 'completed' | 'failed' | 'skipped';
  commitProgress?: { percent: number; loaded: number; total?: number | null };
  commitError?: string;
  /** True when the file size deviates significantly from its siblings */
  hasSizeAnomaly?: boolean;
}

export interface SeasonDiffItem {
  seasonNumber: number;
  name: string;
  incomingEpisodeCount: number;
  localEpisodeCount: number;
  diff: number;
  isNewSeason: boolean;
  badgeText: string;
  badgeType: 'existing' | 'new-eps' | 'new-season';
}

// ─── Archive job DTOs ───────────────────────────────────────────────────────

export type ArchiveJobPhase = ArchiveIngestJobStatus | 'idle';

/** Legacy alias kept for modal compat during migration. */
export type ArchivePreviewPhase =
  | 'idle'
  | 'downloading'
  | 'extracting'
  | 'done'
  | 'error';

export interface ArchiveDownloadProgress {
  loaded: number;
  total?: number | null;
  percent?: number | null;
}

export interface ArchiveExtractProgress {
  currentFile: string;
  totalFiles?: number | null;
}

export interface ArchiveUploadView {
  currentIndex: number;
  totalFiles: number;
  activeFilename: string | null;
  percent: number;
  loaded: number;
  total: number | null;
}

// ─── Hook option contracts ──────────────────────────────────────────────────

export interface UseBulkScrapeSourcesOptions {
  seriesId?: string;
  initialSourceType?: string;
  onSuccess?: () => void;
  stepDelayMs?: number;
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
}

export interface UseBulkIngestSourcesOptions {
  seriesId?: string;
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
  onSuccess?: () => void;
}

export interface UseArchiveIngestSourcesOptions {
  seriesId?: string;
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
  onSuccess?: () => void;
}

// ─── Modal & component prop contracts ───────────────────────────────────────

export interface BulkIngestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  localEpisodes?: LocalEpisodeItem[];
  seasons?: SeasonGroupOption[];
  onSuccess?: () => void;
}

export interface BulkScrapeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  localEpisodes?: LocalEpisodeItem[];
  seasons?: SeasonGroupOption[];
  onSuccess?: () => void;
}

export interface SyncTmdbModalProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  series: SeriesDetails;
}

export interface TargetEpisodeComboboxProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  disabled?: boolean;
  scrapedTitle: string;
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
  targetSeasonId?: string;
}

export interface StorageProviderOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface StorageProviderSelectProps {
  storageProviders: StorageProviderOption[];
  selectedStorageProviderId: string;
  setSelectedStorageProviderId: (id: string) => void;
  disabled?: boolean;
}

export interface IngestionStatusBadgeProps {
  status: string;
}

export interface IngestionBadgeProps {
  children: React.ReactNode;
}

export interface CountBadgeProps {
  children: React.ReactNode;
  tone?: 'green' | 'blue' | 'amber';
}

export interface IngestionProgressBarProps {
  /** 0–100 fill. `null` renders an indeterminate (pulsing) bar. */
  value: number | null;
  ariaLabel: string;
  tone?: 'green' | 'blue';
  size?: 'sm' | 'md';
  testId?: string;
}
