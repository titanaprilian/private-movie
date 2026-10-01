import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  archiveIngestPreview,
  archiveIngestCommit,
  archiveIngestCleanup,
  type ArchiveStagedFileItem,
} from './api';
import type { LocalEpisodeItem, SeasonGroupOption } from './useBulkScrapeSources';
import { getSeasonOptions } from './useBulkScrapeSources';
import { useQuery } from '@tanstack/react-query';
import { storageProvidersQueryOptions, type StorageProviderItem } from '@/modules/storage';

// ─── State Types ──────────────────────────────────────────────────────────────

export type ArchivePreviewPhase =
  | 'idle'
  | 'downloading'
  | 'extracting'
  | 'done'
  | 'error';

export interface ArchiveReviewItem {
  /** fileId from the staging server */
  fileId: string;
  filename: string;
  fileSizeBytes: number;
  detectedEpisodeNumber: number | null;
  matchedEpisodeId: string | null;
  quality: string | null;
  needsReview: boolean;
  isIgnored: boolean;
  label: string;
  /** Commit-phase status */
  commitStatus: 'pending' | 'uploading' | 'completed' | 'failed' | 'skipped';
  commitProgress?: { percent: number; loaded: number; total?: number | null };
  commitError?: string;
}

export interface UseArchiveIngestSourcesOptions {
  seriesId?: string;
  seasons?: SeasonGroupOption[];
  localEpisodes?: LocalEpisodeItem[];
  onSuccess?: () => void;
}

// ─── Preview download/extract progress ───────────────────────────────────────

export interface ArchiveDownloadProgress {
  loaded: number;
  total?: number | null;
  percent?: number | null;
}

export interface ArchiveExtractProgress {
  currentFile: string;
  totalFiles?: number | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useArchiveIngestSources(options?: UseArchiveIngestSourcesOptions) {
  const queryClient = useQueryClient();
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  // ─── Storage Providers ──────────────────────────────────────────────────────
  const { data: rawProviders } = useQuery(storageProvidersQueryOptions());
  const storageProviders = useMemo(
    () => (Array.isArray(rawProviders) ? (rawProviders as StorageProviderItem[]) : []),
    [rawProviders]
  );
  const defaultProvider = useMemo(
    () => storageProviders.find((p) => p.isDefault) || storageProviders[0] || null,
    [storageProviders]
  );
  const [selectedStorageProviderId, setSelectedStorageProviderId] = useState<string>(
    () => defaultProvider?.id ?? ''
  );
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
      if (!selectedSeasonId || !seasonOptions.some((s) => s.id === selectedSeasonId)) {
        setSelectedSeasonId(seasonOptions[0].id);
      }
    }
  }, [seasonOptions, selectedSeasonId]);

  const availableLocalEpisodes = useMemo((): LocalEpisodeItem[] => {
    let result: LocalEpisodeItem[] = [];

    if (options?.seasons && options.seasons.length > 0) {
      const targetSeason =
        options.seasons.find((s) => s.id === selectedSeasonId) ?? options.seasons[0];
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

    if (result.length === 0 && options?.localEpisodes && options.localEpisodes.length > 0) {
      if (selectedSeasonId) {
        result = options.localEpisodes.filter((ep) => ep.seasonId === selectedSeasonId);
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

  // ─── Step 1 — Preview phase tracking ───────────────────────────────────────
  const [previewPhase, setPreviewPhase] = useState<ArchivePreviewPhase>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<ArchiveDownloadProgress | null>(null);
  const [extractProgress, setExtractProgress] = useState<ArchiveExtractProgress | null>(null);

  // ─── Staging session (returned from preview) ────────────────────────────────
  const [stagingSessionId, setStagingSessionId] = useState<string | null>(null);

  // ─── Step 2 — Review items ──────────────────────────────────────────────────
  const [reviewItems, setReviewItems] = useState<ArchiveReviewItem[]>([]);

  // ─── Step 3 — Commit state ──────────────────────────────────────────────────
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitCompletedCount, setCommitCompletedCount] = useState(0);

  // ─── Overall modal step ─────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const abortControllerRef = useRef<AbortController | null>(null);

  // ─── Preview: Map staged items → review items ───────────────────────────────
  const mapStagedItems = useCallback(
    (items: ArchiveStagedFileItem[]): ArchiveReviewItem[] => {
      return items.map((item) => {
        let matchedEpisodeId = item.matchedEpisodeId ?? null;
        let needsReview = item.needsReview;

        // If backend already matched, use it; otherwise try locally by episode order
        if (!matchedEpisodeId && item.detectedEpisodeNumber !== null) {
          const match = availableLocalEpisodes.find(
            (ep) => ep.order === item.detectedEpisodeNumber
          );
          if (match) {
            matchedEpisodeId = match.id;
            needsReview = false;
          }
        }

        return {
          fileId: item.fileId,
          filename: item.filename,
          fileSizeBytes: item.fileSizeBytes,
          detectedEpisodeNumber: item.detectedEpisodeNumber ?? null,
          matchedEpisodeId,
          quality: item.quality ?? null,
          needsReview,
          isIgnored: false,
          label: defaultLabel || 'S3 Video',
          commitStatus: 'pending',
          commitProgress: undefined,
          commitError: undefined,
        };
      });
    },
    [availableLocalEpisodes, defaultLabel]
  );

  // ─── Step 1 action: Start preview ──────────────────────────────────────────
  const startPreview = useCallback(async () => {
    if (!archiveUrl.trim()) {
      toast.error('Archive URL required', {
        description: 'Please enter a valid archive download URL.',
      });
      return;
    }

    setPreviewPhase('downloading');
    setPreviewError(null);
    setDownloadProgress(null);
    setExtractProgress(null);
    setStagingSessionId(null);
    setReviewItems([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await archiveIngestPreview(
        optionsRef.current?.seriesId ?? '',
        {
          url: archiveUrl.trim(),
          password: archivePassword.trim() || undefined,
          referer: archiveReferer.trim() || undefined,
          targetSeasonId: selectedSeasonId || undefined,
        },
        {
          onDownloadProgress: (p) => {
            setPreviewPhase('downloading');
            setDownloadProgress(p);
          },
          onExtractProgress: (p) => {
            setPreviewPhase('extracting');
            setExtractProgress(p);
          },
          signal: controller.signal,
        }
      );

      if (controller.signal.aborted) return;

      setStagingSessionId(result.stagingSessionId);
      setReviewItems(mapStagedItems(result.items));
      setPreviewPhase('done');
      setStep(2);
    } catch (err: unknown) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        setPreviewPhase('idle');
        return;
      }

      const message =
        err instanceof Error ? err.message : 'Archive preview failed';
      setPreviewError(message);
      setPreviewPhase('error');

      toast.error('Archive preview failed', { description: message });
    }
  }, [archiveUrl, archivePassword, archiveReferer, selectedSeasonId, mapStagedItems]);

  // ─── Review item mutation helpers ───────────────────────────────────────────
  const updateReviewMapping = useCallback((index: number, episodeId: string | null) => {
    setReviewItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          matchedEpisodeId: episodeId,
          needsReview: episodeId === null,
        };
      })
    );
  }, []);

  const updateReviewLabel = useCallback((index: number, label: string) => {
    setReviewItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, label } : item))
    );
  }, []);

  const updateReviewQuality = useCallback((index: number, quality: string) => {
    setReviewItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quality: quality || null } : item))
    );
  }, []);

  const toggleReviewIgnore = useCallback((index: number) => {
    setReviewItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, isIgnored: !item.isIgnored } : item
      )
    );
  }, []);

  // ─── Review summary counts ──────────────────────────────────────────────────
  const totalCount = reviewItems.length;
  const matchedCount = useMemo(
    () =>
      reviewItems.filter((i) => !i.isIgnored && i.matchedEpisodeId !== null).length,
    [reviewItems]
  );
  const needsReviewCount = useMemo(
    () =>
      reviewItems.filter(
        (i) => !i.isIgnored && (i.needsReview || i.matchedEpisodeId === null)
      ).length,
    [reviewItems]
  );

  // ─── Step 2 → Step 3: Commit ────────────────────────────────────────────────
  const startCommit = useCallback(async () => {
    if (!stagingSessionId) {
      toast.error('No staging session', {
        description: 'Preview must complete before committing.',
      });
      return;
    }

    setStep(3);
    setIsCommitting(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Initialize commit status
    const initialItems = reviewItems.map((item) => {
      if (item.isIgnored || !item.matchedEpisodeId) {
        return { ...item, commitStatus: 'skipped' as const };
      }
      return { ...item, commitStatus: 'pending' as const, commitProgress: undefined, commitError: undefined };
    });
    setReviewItems(initialItems);

    const activeItems = initialItems.filter(
      (i) => !i.isIgnored && i.matchedEpisodeId !== null
    );
    setCommitCompletedCount(initialItems.length - activeItems.length);

    const commitItems = activeItems.map((item) => ({
      fileId: item.fileId,
      episodeId: item.matchedEpisodeId!,
      label: item.label || undefined,
      quality: item.quality || undefined,
    }));

    let completedSoFar = initialItems.length - activeItems.length;

    try {
      let successCount = 0;

      await archiveIngestCommit(
        optionsRef.current?.seriesId ?? '',
        {
          stagingSessionId,
          storageProviderId: selectedStorageProviderId,
          defaultLabel: defaultLabel || undefined,
          items: commitItems,
        },
        {
          onUploadProgress: (p) => {
            // Map fileIndex to actual item index in reviewItems
            setReviewItems((prev) =>
              prev.map((item) => {
                if (item.fileId === commitItems[p.fileIndex]?.fileId) {
                  return {
                    ...item,
                    commitStatus: 'uploading',
                    commitProgress: { percent: p.percent, loaded: p.loaded, total: p.total },
                  };
                }
                return item;
              })
            );
          },
          onFileCompleted: (p) => {
            // Find item by episode id
            setReviewItems((prev) =>
              prev.map((item) => {
                if (item.matchedEpisodeId === p.episodeId) {
                  return { ...item, commitStatus: 'completed' };
                }
                return item;
              })
            );
            successCount++;
            completedSoFar++;
            setCommitCompletedCount(completedSoFar);
          },
          signal: controller.signal,
        }
      );

      if (controller.signal.aborted) return;

      setIsCommitting(false);

      // Invalidate series queries
      const sid = optionsRef.current?.seriesId;
      if (sid) {
        queryClient.invalidateQueries({ queryKey: ['series', sid] });
        queryClient.invalidateQueries({ queryKey: ['series'] });
        queryClient.invalidateQueries({ queryKey: ['episodes'] });
      }

      toast.success('Archive ingestion complete', {
        description: `Successfully ingested ${successCount} video source(s) from archive.`,
      });

      optionsRef.current?.onSuccess?.();
    } catch (err: unknown) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        setIsCommitting(false);
        return;
      }

      const message = err instanceof Error ? err.message : 'Archive commit failed';
      setIsCommitting(false);

      // Mark any still-uploading items as failed
      setReviewItems((prev) =>
        prev.map((item) => {
          if (item.commitStatus === 'uploading' || item.commitStatus === 'pending') {
            return { ...item, commitStatus: 'failed', commitError: message };
          }
          return item;
        })
      );

      toast.error('Archive commit failed', { description: message });
    }
  }, [
    stagingSessionId,
    reviewItems,
    selectedStorageProviderId,
    defaultLabel,
    queryClient,
  ]);

  // ─── Cancel (abort and cleanup) ─────────────────────────────────────────────
  const cancelAndCleanup = useCallback(async () => {
    abortControllerRef.current?.abort();
    setIsCommitting(false);
    setPreviewPhase('idle');

    const sid = stagingSessionId;
    const seriesId = optionsRef.current?.seriesId;
    if (sid && seriesId) {
      // Fire-and-forget cleanup
      void archiveIngestCleanup(seriesId, sid);
    }
  }, [stagingSessionId]);

  // ─── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(async () => {
    await cancelAndCleanup();

    setStep(1);
    setArchiveUrl('');
    setArchivePassword('');
    setArchiveReferer('');
    setDefaultLabel('S3 Video');
    setPreviewPhase('idle');
    setPreviewError(null);
    setDownloadProgress(null);
    setExtractProgress(null);
    setStagingSessionId(null);
    setReviewItems([]);
    setIsCommitting(false);
    setCommitCompletedCount(0);

    const currentSeasonOptions = getSeasonOptions(
      optionsRef.current?.seasons,
      optionsRef.current?.localEpisodes
    );
    setSelectedSeasonId(currentSeasonOptions[0]?.id ?? '');
    setSelectedStorageProviderId(defaultProvider?.id ?? '');
  }, [cancelAndCleanup, defaultProvider]);

  // ─── Derived progress ───────────────────────────────────────────────────────
  const progressPercentage =
    totalCount > 0 ? Math.round((commitCompletedCount / totalCount) * 100) : 0;

  const activeCommitItem = useMemo(
    () => reviewItems.find((i) => i.commitStatus === 'uploading') ?? null,
    [reviewItems]
  );

  const selectedProviderName =
    storageProviders.find((p) => p.id === selectedStorageProviderId)?.name ?? null;

  return {
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

    // Preview phase
    previewPhase,
    previewError,
    downloadProgress,
    extractProgress,
    startPreview,

    // Staging
    stagingSessionId,

    // Review items
    reviewItems,
    updateReviewMapping,
    updateReviewLabel,
    updateReviewQuality,
    toggleReviewIgnore,
    totalCount,
    matchedCount,
    needsReviewCount,

    // Commit
    isCommitting,
    commitCompletedCount,
    progressPercentage,
    activeCommitItem,
    startCommit,

    // Cancel & lifecycle
    cancelAndCleanup,
    reset,
  };
}
