import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  storageProvidersQueryOptions,
  type StorageProviderItem,
} from '@/modules/storage';
import type {
  LocalEpisodeItem,
  UseArchiveIngestSourcesOptions,
} from '../../types';
import { getSeasonOptions } from '../../scrape/hooks/useBulkScrapeSources';
import {
  deriveArchiveStep,
  derivePreviewPhase,
  pickDefaultStorageProvider,
} from './archiveIngestUtils';
import { useArchiveIngestJob } from './useArchiveIngestJob';
import { useArchiveIngestReview } from './useArchiveIngestReview';

export {
  ARCHIVE_POLL_DELAY_MS,
  ARCHIVE_SESSION_EXPIRED_MESSAGE,
  computeSizeAnomalyFilenames,
  pickDefaultStorageProvider,
} from './archiveIngestUtils';

export function useArchiveIngestSources(
  options?: UseArchiveIngestSourcesOptions
) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  // ─── Storage Providers ──────────────────────────────────────────────────────
  const { data: rawProviders } = useQuery(storageProvidersQueryOptions());
  const storageProviders = useMemo(
    () =>
      Array.isArray(rawProviders)
        ? (rawProviders as StorageProviderItem[])
        : [],
    [rawProviders]
  );
  const defaultProvider = useMemo(
    () => pickDefaultStorageProvider(storageProviders),
    [storageProviders]
  );
  const [selectedStorageProviderId, setSelectedStorageProviderId] =
    useState<string>(() => defaultProvider?.id ?? '');
  useEffect(() => {
    if (defaultProvider && !selectedStorageProviderId) {
      setSelectedStorageProviderId(defaultProvider.id);
    }
  }, [defaultProvider, selectedStorageProviderId]);

  // ─── Season selection ───────────────────────────────────────────────────────
  const seasonOptions = useMemo(
    () => getSeasonOptions(options?.seasons, options?.localEpisodes),
    [options?.seasons, options?.localEpisodes]
  );
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    () => seasonOptions[0]?.id ?? ''
  );
  useEffect(() => {
    if (seasonOptions.length > 0) {
      if (
        !selectedSeasonId ||
        !seasonOptions.some((s) => s.id === selectedSeasonId)
      ) {
        setSelectedSeasonId(seasonOptions[0].id);
      }
    }
  }, [seasonOptions, selectedSeasonId]);

  const availableLocalEpisodes = useMemo((): LocalEpisodeItem[] => {
    let result: LocalEpisodeItem[] = [];

    if (options?.seasons && options.seasons.length > 0) {
      const targetSeason =
        options.seasons.find((s) => s.id === selectedSeasonId) ??
        options.seasons[0];
      if (targetSeason?.episodes) {
        result = targetSeason.episodes.map((ep) => ({
          id: ep.id,
          title: ep.title,
          order: ep.order,
          seasonId: targetSeason.id,
          seasonTitle: targetSeason.title ?? undefined,
          hasSources: ep.hasSources,
        }));
      }
    }

    if (
      result.length === 0 &&
      options?.localEpisodes &&
      options.localEpisodes.length > 0
    ) {
      if (selectedSeasonId) {
        result = options.localEpisodes.filter(
          (ep) => ep.seasonId === selectedSeasonId
        );
      }
      if (result.length === 0) {
        result = options.localEpisodes;
      }
    }

    return result;
  }, [selectedSeasonId, options?.seasons, options?.localEpisodes]);

  // ─── Step 1 — Archive inputs ────────────────────────────────────────────────
  const [archiveUrl, setArchiveUrl] = useState('');
  const [archivePassword, setArchivePassword] = useState('');
  const [archiveReferer, setArchiveReferer] = useState('');
  const [defaultLabel, setDefaultLabel] = useState('S3 Video');

  // ─── Extracted Hook: Job Lifecycle & Polling ────────────────────────────────
  const jobState = useArchiveIngestJob({
    seriesId: options?.seriesId,
    onSuccess: options?.onSuccess,
  });
  const {
    startJob: jobStartJob,
    confirmJob,
    retryWithPassword: jobRetryWithPassword,
    resetJob,
  } = jobState;

  // ─── Extracted Hook: Review Items & Overrides ───────────────────────────────
  const reviewState = useArchiveIngestReview({
    job: jobState.job,
    availableLocalEpisodes,
    defaultLabel,
  });
  const { reviewItems, resetReview } = reviewState;

  // ─── Modal Step ─────────────────────────────────────────────────────────────
  const [stepOverride, setStepOverride] = useState<1 | 2 | 3 | null>(null);
  const derivedStep = deriveArchiveStep(jobState.jobStatus);
  const step = stepOverride ?? derivedStep;
  const setStep = useCallback((s: 1 | 2 | 3) => setStepOverride(s), []);

  // ─── Actions Bridging ───────────────────────────────────────────────────────
  const startJob = useCallback(async () => {
    resetReview();
    setStepOverride(null);
    return jobStartJob({
      sourceUrl: archiveUrl,
      storageProviderId: selectedStorageProviderId || null,
      password: archivePassword.trim() || null,
      referer: archiveReferer.trim() || null,
    });
  }, [
    resetReview,
    jobStartJob,
    archiveUrl,
    selectedStorageProviderId,
    archivePassword,
    archiveReferer,
  ]);

  const confirmSelection = useCallback(async () => {
    const selection = reviewItems.map((item) => ({
      filename: item.filename,
      episodeId: item.isIgnored ? null : item.matchedEpisodeId,
      label: item.label || null,
      quality: item.quality || null,
      isIgnored: item.isIgnored,
    }));
    const confirmed = await confirmJob({
      selection,
      storageProviderId: selectedStorageProviderId || null,
    });
    if (confirmed) {
      setStepOverride(3);
    }
    return confirmed;
  }, [confirmJob, reviewItems, selectedStorageProviderId]);

  const retryWithPassword = useCallback(async () => {
    return jobRetryWithPassword(archivePassword);
  }, [jobRetryWithPassword, archivePassword]);

  const reset = useCallback(() => {
    resetJob();
    resetReview();
    setStepOverride(1);
    setArchiveUrl('');
    setArchivePassword('');
    setArchiveReferer('');
    setDefaultLabel('S3 Video');

    const currentSeasonOptions = getSeasonOptions(
      optionsRef.current?.seasons,
      optionsRef.current?.localEpisodes
    );
    setSelectedSeasonId(currentSeasonOptions[0]?.id ?? '');
    setSelectedStorageProviderId(defaultProvider?.id ?? '');
  }, [resetJob, resetReview, defaultProvider]);

  // ─── Legacy Mappings (Modal compat) ─────────────────────────────────────────
  const previewPhase = derivePreviewPhase(jobState.jobStatus);
  const previewError = jobState.jobError ?? jobState.job?.errorMessage ?? null;
  const stagingSessionId = jobState.jobId;
  const isCommitting =
    jobState.jobStatus === 'uploading' || jobState.isSubmitting;
  const selectedProviderName =
    storageProviders.find((p) => p.id === selectedStorageProviderId)?.name ??
    null;

  return {
    // Durable job state
    job: jobState.job,
    jobId: jobState.jobId,
    jobStatus: jobState.jobStatus,
    jobError: jobState.jobError,
    jobErrorCode: jobState.jobErrorCode,
    isJobActive: jobState.isJobActive,
    isPolling: jobState.isPolling,
    isSubmitting: jobState.isSubmitting,
    needsPassword: jobState.needsPassword,
    sizeAnomalyFilenames: reviewState.sizeAnomalyFilenames,
    uploadView: jobState.uploadView,
    downloadProgress: jobState.downloadProgress,
    extractProgress: jobState.extractProgress,

    // Actions
    startJob,
    confirmSelection,
    cancelJob: jobState.cancelJob,
    retryWithPassword,

    // Step navigation
    step,
    setStep,

    // Storage
    storageProviders,
    selectedStorageProviderId,
    setSelectedStorageProviderId,
    selectedProviderName,

    // Season
    seasonOptions,
    selectedSeasonId,
    setSelectedSeasonId,
    availableLocalEpisodes,

    // Archive inputs
    archiveUrl,
    setArchiveUrl,
    archivePassword,
    setArchivePassword,
    archiveReferer,
    setArchiveReferer,
    defaultLabel,
    setDefaultLabel,

    // Preview phase (legacy-mapped)
    previewPhase,
    previewError,
    startPreview: startJob,

    // Staging
    stagingSessionId,

    // Review items
    reviewItems: reviewState.reviewItems,
    updateReviewMapping: reviewState.updateReviewMapping,
    updateReviewLabel: reviewState.updateReviewLabel,
    updateReviewQuality: reviewState.updateReviewQuality,
    toggleReviewIgnore: reviewState.toggleReviewIgnore,
    totalCount: reviewState.totalCount,
    matchedCount: reviewState.matchedCount,
    needsReviewCount: reviewState.needsReviewCount,

    // Commit (legacy-mapped)
    isCommitting,
    commitCompletedCount: reviewState.commitCompletedCount,
    progressPercentage: jobState.progressPercentage,
    activeCommitItem: reviewState.activeCommitItem,
    startCommit: confirmSelection,

    // Cancel & lifecycle
    cancelAndCleanup: jobState.cancelAndCleanup,
    reset,
  };
}
