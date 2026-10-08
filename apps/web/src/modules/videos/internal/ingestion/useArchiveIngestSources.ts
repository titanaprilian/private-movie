import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  cancelArchiveIngestJob,
  confirmArchiveIngestJob,
  createArchiveIngestJob,
  getArchiveIngestJob,
  getArchiveIngestJobProgress,
  retryArchiveIngestJob,
} from '../api';
import type {
  ArchiveIngestJob,
  ArchiveIngestJobEntry,
  ArchiveIngestJobStatus,
} from '@repo/contracts';
import type { LocalEpisodeItem, SeasonGroupOption } from './useBulkScrapeSources';
import { getSeasonOptions } from './useBulkScrapeSources';
import { useQuery } from '@tanstack/react-query';
import { storageProvidersQueryOptions, type StorageProviderItem } from '@/modules/storage';

// ─── State Types ──────────────────────────────────────────────────────────────

export type ArchiveJobPhase = ArchiveIngestJobStatus | 'idle';

/** Legacy alias kept for modal compat during migration. */
export type ArchivePreviewPhase =
  | 'idle'
  | 'downloading'
  | 'extracting'
  | 'done'
  | 'error';

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

export interface ArchiveUploadView {
  currentIndex: number;
  totalFiles: number;
  activeFilename: string | null;
  percent: number;
  loaded: number;
  total: number | null;
}

/** Statuses that keep the 1s polling loop alive. */
export const ARCHIVE_POLL_STATUSES: ReadonlySet<string> = new Set([
  'queued',
  'downloading',
  'listing',
  'uploading',
]);

/**
 * Pick the storage provider that new uploads should target by default:
 * the enabled provider marked as default, else the first enabled provider,
 * else the marked default (even if disabled), else the first provider.
 * Uploads explicitly send `storageProviderId: null` when nothing is picked,
 * letting the backend resolve its active default provider.
 */
export function pickDefaultStorageProvider(
  providers: StorageProviderItem[]
): StorageProviderItem | null {
  if (!Array.isArray(providers) || providers.length === 0) return null;
  return (
    providers.find((p) => p.isDefault && p.isEnabled) ??
    providers.find((p) => p.isEnabled) ??
    providers.find((p) => p.isDefault) ??
    providers[0] ??
    null
  );
}

/**
 * Delay between a poll response resolving and the next poll being issued.
 * Polls run sequentially (recursive timeout, never overlapping) rather than
 * on a fixed interval so slow responses can't pile up.
 */
export const ARCHIVE_POLL_DELAY_MS = 3000;

/** Error surfaced when polling halts on a terminal auth failure. */
export const ARCHIVE_SESSION_EXPIRED_MESSAGE =
  'Session expired. Please sign in again to continue.';

export function isPasswordErrorCode(code: string | null | undefined): boolean {
  return code === 'PASSWORD_REQUIRED' || code === 'PASSWORD_INCORRECT';
}

/**
 * Flags entries whose size deviates significantly from the median sibling
 * size (less than half or more than double the median). Requires at least
 * 3 entries with known sizes to avoid false positives on tiny packs.
 */
export function computeSizeAnomalyFilenames(
  entries: Array<{ filename: string; sizeBytes: number | null }>
): Set<string> {
  const sized = entries.filter(
    (e): e is { filename: string; sizeBytes: number } =>
      typeof e.sizeBytes === 'number' && e.sizeBytes > 0
  );
  if (sized.length < 3) return new Set();

  const sorted = [...sized].map((e) => e.sizeBytes).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  if (!median || median <= 0) return new Set();

  const flagged = new Set<string>();
  for (const entry of sized) {
    if (entry.sizeBytes < median * 0.5 || entry.sizeBytes > median * 2) {
      flagged.add(entry.filename);
    }
  }
  return flagged;
}

function parseUploadStage(stage: string | null | undefined): {
  currentIndex: number | null;
  totalFiles: number | null;
  activeFilename: string | null;
} {
  if (!stage) return { currentIndex: null, totalFiles: null, activeFilename: null };
  const fraction = stage.match(/(\d+)\s*\/\s*(\d+)/);
  const afterColon = stage.includes(':') ? stage.slice(stage.lastIndexOf(':') + 1).trim() : null;
  return {
    currentIndex: fraction ? Number(fraction[1]) : null,
    totalFiles: fraction ? Number(fraction[2]) : null,
    activeFilename: afterColon || null,
  };
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
    () => pickDefaultStorageProvider(storageProviders),
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

  // ─── Durable job state ──────────────────────────────────────────────────────
  const [job, setJob] = useState<ArchiveIngestJob | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set once a poll fails with a terminal 401 (silent refresh already failed
  // inside authFetch): the polling chain halts and surfaces session expiry.
  // Cleared whenever a new job starts.
  const [pollHalted, setPollHalted] = useState(false);

  const jobId = job?.id ?? null;
  const jobStatus: ArchiveJobPhase = job?.status ?? 'idle';
  const jobErrorCode = job?.errorCode ?? null;
  const isJobActive = job ? ARCHIVE_POLL_STATUSES.has(job.status) : false;
  const isPolling = !!jobId && !!options?.seriesId && !pollHalted && ARCHIVE_POLL_STATUSES.has(job?.status ?? '');

  // ─── Step 2 — Review items (derived from job entries) ───────────────────────
  const reviewItems = useMemo((): ArchiveReviewItem[] => {
    if (!job || job.entries.length === 0) return [];
    const anomalies = computeSizeAnomalyFilenames(job.entries);
    const completedSet = new Set(
      job.selection.filter((s) => s.completed).map((s) => s.filename)
    );
    const activeFromStage = parseUploadStage(job.stage).activeFilename;
    return job.entries.map((entry: ArchiveIngestJobEntry) => {
      let matchedEpisodeId: string | null = null;
      let needsReview = entry.needsReview ?? true;

      if (entry.detectedEpisodeNumber !== null && entry.detectedEpisodeNumber !== undefined) {
        const match = availableLocalEpisodes.find(
          (ep) => ep.order === entry.detectedEpisodeNumber
        );
        if (match) {
          matchedEpisodeId = match.id;
          needsReview = false;
        }
      }

      // Preserve user edits held in the confirmed selection, if any
      const selected = job.selection?.find((s) => s.filename === entry.filename);
      if (selected) {
        if (selected.episodeId) {
          matchedEpisodeId = selected.episodeId;
          needsReview = false;
        }
        if (selected.isIgnored) {
          needsReview = false;
        }
      }

      const ignored = selected?.isIgnored ?? false;
      const status = job.status;
      const isCompleted =
        completedSet.has(entry.filename) || selected?.completed === true;
      let commitStatus: ArchiveReviewItem['commitStatus'];
      if (ignored) {
        commitStatus = 'skipped';
      } else if (status === 'done') {
        commitStatus = 'completed';
      } else if (status === 'failed') {
        commitStatus = isCompleted ? 'completed' : 'failed';
      } else if (status === 'uploading') {
        commitStatus = isCompleted
          ? 'completed'
          : entry.filename === activeFromStage
            ? 'uploading'
            : 'pending';
      } else {
        commitStatus = 'pending';
      }

      return {
        fileId: entry.filename,
        filename: entry.filename,
        fileSizeBytes: entry.sizeBytes ?? 0,
        detectedEpisodeNumber: entry.detectedEpisodeNumber ?? null,
        matchedEpisodeId,
        quality: entry.quality ?? selected?.quality ?? null,
        needsReview: ignored ? false : needsReview,
        isIgnored: ignored,
        label: selected?.label || defaultLabel || 'S3 Video',
        commitStatus,
        commitProgress:
          status === 'uploading'
            ? {
                percent:
                  job.bytesTotal && job.bytesTotal > 0
                    ? Math.round((job.bytesDone / job.bytesTotal) * 100)
                    : 0,
                loaded: job.bytesDone,
                total: job.bytesTotal,
              }
            : undefined,
        commitError: status === 'failed' ? (job.errorMessage ?? undefined) : undefined,
        hasSizeAnomaly: anomalies.has(entry.filename),
      };
    });
  }, [job, availableLocalEpisodes, defaultLabel]);

  const [reviewOverrides, setReviewOverrides] = useState<
    Record<string, { episodeId: string | null; label?: string; quality?: string | null; isIgnored?: boolean }>
  >({});

  const effectiveReviewItems = useMemo((): ArchiveReviewItem[] => {
    if (Object.keys(reviewOverrides).length === 0) return reviewItems;
    return reviewItems.map((item) => {
      const override = reviewOverrides[item.filename];
      if (!override) return item;
      const matchedEpisodeId =
        override.episodeId !== undefined ? override.episodeId : item.matchedEpisodeId;
      const isIgnored = override.isIgnored ?? item.isIgnored;
      return {
        ...item,
        matchedEpisodeId,
        isIgnored,
        needsReview: isIgnored ? false : matchedEpisodeId === null,
        label: override.label ?? item.label,
        quality: override.quality !== undefined ? override.quality : item.quality,
      };
    });
  }, [reviewItems, reviewOverrides]);

  // ─── Overall modal step (driven by job status) ──────────────────────────────
  const [stepOverride, setStepOverride] = useState<1 | 2 | 3 | null>(null);
  const derivedStep: 1 | 2 | 3 =
    jobStatus === 'ready' ? 2 : jobStatus === 'uploading' || jobStatus === 'done' ? 3 : 1;
  const step = stepOverride ?? derivedStep;
  const setStep = useCallback((s: 1 | 2 | 3) => setStepOverride(s), []);

  // ─── Sequential polling loop (3s after each response, paused when hidden) ──
  const seriesIdRef = useRef(options?.seriesId);
  useEffect(() => {
    seriesIdRef.current = options?.seriesId;
  });
  const jobIdRef = useRef<string | null>(null);
  useEffect(() => {
    jobIdRef.current = jobId;
  });
  const jobStatusRef = useRef(jobStatus);
  useEffect(() => {
    jobStatusRef.current = jobStatus;
  });
  const jobRef = useRef(job);
  useEffect(() => {
    jobRef.current = job;
  });

  // Poll-halt flag is declared above (next to job state); reset it whenever a
  // new job starts so a fresh job polls even after a previous halt.
  useEffect(() => {
    setPollHalted(false);
  }, [jobId]);

  useEffect(() => {
    const sid = options?.seriesId;
    if (!sid || !jobId || pollHalted || !ARCHIVE_POLL_STATUSES.has(job?.status ?? '')) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      if (cancelled) return;
      timer = setTimeout(() => {
        timer = null;
        void runPoll();
      }, ARCHIVE_POLL_DELAY_MS);
    };

    const runPoll = async () => {
      if (cancelled) return;
      // Pause on background tabs: defer until the tab is visible again.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        scheduleNext();
        return;
      }
      try {
        const currentSid = seriesIdRef.current;
        const currentJobId = jobIdRef.current;
        if (!currentSid || !currentJobId) return;
        let updated: ArchiveIngestJob;
        if (jobStatusRef.current === 'uploading') {
          // Lightweight progress poll: patch counters/stage/completion flags
          // into local state, preserving user episode mapping & quality
          // overrides held in selection.
          const progress = await getArchiveIngestJobProgress(currentSid, currentJobId);
          if (cancelled) return;
          if (progress.status === 'done' || progress.status === 'failed') {
            // Terminal state: fetch the full job once for final entries/selection.
            try {
              updated = await getArchiveIngestJob(currentSid, currentJobId);
            } catch {
              const completedSet = new Set(progress.completedFilenames ?? []);
              const prev = jobRef.current;
              if (!prev) return;
              updated = {
                ...prev,
                status: progress.status,
                stage: progress.stage,
                bytesDone: progress.bytesDone,
                bytesTotal: progress.bytesTotal,
                errorCode: progress.errorCode,
                errorMessage: progress.errorMessage,
                selection: prev.selection.map((s) => ({
                  ...s,
                  completed: completedSet.has(s.filename) ? true : s.completed,
                })),
              };
            }
          } else {
            const completedSet = new Set(progress.completedFilenames ?? []);
            const prev = jobRef.current;
            if (!prev) return;
            updated = {
              ...prev,
              status: progress.status,
              stage: progress.stage,
              bytesDone: progress.bytesDone,
              bytesTotal: progress.bytesTotal,
              errorCode: progress.errorCode,
              errorMessage: progress.errorMessage,
              selection: prev.selection.map((s) => ({
                ...s,
                completed: completedSet.has(s.filename) ? true : s.completed,
              })),
            };
          }
        } else {
          updated = await getArchiveIngestJob(currentSid, currentJobId);
        }
        if (cancelled) return;
        setJob(updated);
        setJobError(null);
        if (updated.status === 'done') {
          const doneSid = seriesIdRef.current;
          if (doneSid) {
            queryClient.invalidateQueries({ queryKey: ['series', doneSid] });
            queryClient.invalidateQueries({ queryKey: ['series'] });
            queryClient.invalidateQueries({ queryKey: ['episodes'] });
          }
          optionsRef.current?.onSuccess?.();
          toast.success('Archive ingestion complete', {
            description: `Ingested ${updated.selection.filter((s) => !s.isIgnored && s.episodeId).length} video source(s) from archive.`,
          });
        }
        if (updated.status === 'failed' && updated.errorMessage) {
          setJobError(updated.errorMessage);
        }
        if (ARCHIVE_POLL_STATUSES.has(updated.status)) {
          scheduleNext();
        }
      } catch (err) {
        if (cancelled) return;
        if ((err as { status?: number } | null)?.status === 401) {
          // Terminal auth failure — stop polling and surface session expiry.
          setPollHalted(true);
          setJobError(ARCHIVE_SESSION_EXPIRED_MESSAGE);
          return;
        }
        setJobError(err instanceof Error ? err.message : 'Failed to poll job status');
        scheduleNext();
      }
    };

    // Poll immediately when the tab becomes visible again.
    const onVisibilityChange = () => {
      if (typeof document === 'undefined' || cancelled) return;
      if (document.visibilityState === 'visible') {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        void runPoll();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    scheduleNext();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [options?.seriesId, jobId, job?.status, pollHalted, queryClient]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const startJob = useCallback(async () => {
    const seriesId = optionsRef.current?.seriesId ?? '';
    if (!archiveUrl.trim()) {
      toast.error('Archive URL required', {
        description: 'Please enter a valid archive download URL.',
      });
      return;
    }
    setIsSubmitting(true);
    setJobError(null);
    setReviewOverrides({});
    setStepOverride(null);
    try {
      const created = await createArchiveIngestJob(seriesId, {
        sourceUrl: archiveUrl.trim(),
        storageProviderId: selectedStorageProviderId || null,
        password: archivePassword.trim() || null,
        referer: archiveReferer.trim() || null,
      });
      setJob(created);
      if (created.status === 'failed' && created.errorMessage) {
        setJobError(created.errorMessage);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start archive ingest job';
      setJobError(message);
      toast.error('Failed to start archive ingest', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  }, [archiveUrl, archivePassword, archiveReferer, selectedStorageProviderId]);

  const confirmSelection = useCallback(async () => {
    const seriesId = optionsRef.current?.seriesId ?? '';
    if (!job) {
      toast.error('No active job', { description: 'Submit an archive URL first.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const selection = effectiveReviewItems.map((item) => ({
        filename: item.filename,
        episodeId: item.isIgnored ? null : item.matchedEpisodeId,
        label: item.label || null,
        quality: item.quality || null,
        isIgnored: item.isIgnored,
      }));
      const confirmed = await confirmArchiveIngestJob(seriesId, job.id, {
        selection,
        storageProviderId: selectedStorageProviderId || null,
      });
      setJob(confirmed);
      setStepOverride(3);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to confirm selection';
      setJobError(message);
      toast.error('Failed to start upload', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  }, [job, effectiveReviewItems, selectedStorageProviderId]);

  const cancelJob = useCallback(async () => {
    const seriesId = optionsRef.current?.seriesId ?? '';
    const currentJobId = jobIdRef.current;
    if (!seriesId || !currentJobId) {
      setJob(null);
      setJobError(null);
      return;
    }
    try {
      const cancelled = await cancelArchiveIngestJob(seriesId, currentJobId);
      setJob(cancelled);
    } catch {
      // Even if the cancel endpoint fails, stop polling locally.
      setJob((prev) =>
        prev ? { ...prev, status: 'cancelled' as ArchiveIngestJobStatus, stage: 'cancelled' } : prev
      );
    }
  }, []);

  const retryWithPassword = useCallback(async () => {
    const seriesId = optionsRef.current?.seriesId ?? '';
    const currentJobId = jobIdRef.current;
    if (!seriesId || !currentJobId) return;
    setIsSubmitting(true);
    try {
      const retried = await retryArchiveIngestJob(
        seriesId,
        currentJobId,
        archivePassword.trim() || null
      );
      setJob(retried);
      setJobError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retry job';
      setJobError(message);
      toast.error('Retry failed', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  }, [archivePassword]);

  // ─── Review item mutation helpers (local overrides) ─────────────────────────
  const updateReviewMapping = useCallback((index: number, episodeId: string | null) => {
    const filename = effectiveReviewItems[index]?.filename;
    if (!filename) return;
    setReviewOverrides((prev) => ({
      ...prev,
      [filename]: {
        episodeId,
        label: prev[filename]?.label ?? effectiveReviewItems[index]?.label,
        quality: prev[filename]?.quality ?? effectiveReviewItems[index]?.quality,
        isIgnored: prev[filename]?.isIgnored ?? effectiveReviewItems[index]?.isIgnored,
      },
    }));
  }, [effectiveReviewItems]);

  const updateReviewLabel = useCallback((index: number, label: string) => {
    const filename = effectiveReviewItems[index]?.filename;
    if (!filename) return;
    setReviewOverrides((prev) => ({
      ...prev,
      [filename]: {
        episodeId: prev[filename]?.episodeId ?? effectiveReviewItems[index]?.matchedEpisodeId ?? null,
        label,
        quality: prev[filename]?.quality ?? effectiveReviewItems[index]?.quality,
        isIgnored: prev[filename]?.isIgnored ?? effectiveReviewItems[index]?.isIgnored,
      },
    }));
  }, [effectiveReviewItems]);

  const updateReviewQuality = useCallback((index: number, quality: string) => {
    const filename = effectiveReviewItems[index]?.filename;
    if (!filename) return;
    setReviewOverrides((prev) => ({
      ...prev,
      [filename]: {
        episodeId: prev[filename]?.episodeId ?? effectiveReviewItems[index]?.matchedEpisodeId ?? null,
        label: prev[filename]?.label ?? effectiveReviewItems[index]?.label,
        quality: quality || null,
        isIgnored: prev[filename]?.isIgnored ?? effectiveReviewItems[index]?.isIgnored,
      },
    }));
  }, [effectiveReviewItems]);

  const toggleReviewIgnore = useCallback((index: number) => {
    const item = effectiveReviewItems[index];
    if (!item) return;
    const filename = item.filename;
    setReviewOverrides((prev) => ({
      ...prev,
      [filename]: {
        episodeId: prev[filename]?.episodeId ?? item.matchedEpisodeId,
        label: prev[filename]?.label ?? item.label,
        quality: prev[filename]?.quality ?? item.quality,
        isIgnored: !(prev[filename]?.isIgnored ?? item.isIgnored),
      },
    }));
  }, [effectiveReviewItems]);

  // ─── Review summary counts ──────────────────────────────────────────────────
  const totalCount = effectiveReviewItems.length;
  const matchedCount = useMemo(
    () =>
      effectiveReviewItems.filter((i) => !i.isIgnored && i.matchedEpisodeId !== null).length,
    [effectiveReviewItems]
  );
  const needsReviewCount = useMemo(
    () =>
      effectiveReviewItems.filter(
        (i) => !i.isIgnored && (i.needsReview || i.matchedEpisodeId === null)
      ).length,
    [effectiveReviewItems]
  );
  const sizeAnomalyFilenames = useMemo(
    () => effectiveReviewItems.filter((i) => i.hasSizeAnomaly).map((i) => i.filename),
    [effectiveReviewItems]
  );

  // ─── Derived progress ───────────────────────────────────────────────────────
  const downloadProgress: ArchiveDownloadProgress | null = useMemo(() => {
    if (!job || (job.status !== 'downloading' && job.status !== 'queued')) return null;
    const percent =
      job.bytesTotal && job.bytesTotal > 0
        ? Math.round((job.bytesDone / job.bytesTotal) * 100)
        : null;
    return { loaded: job.bytesDone, total: job.bytesTotal, percent };
  }, [job]);

  const extractProgress: ArchiveExtractProgress | null = useMemo(() => {
    if (!job || job.status !== 'listing') return null;
    return { currentFile: job.stage || 'Listing archive contents…', totalFiles: job.entries.length || null };
  }, [job]);

  const uploadView: ArchiveUploadView | null = useMemo(() => {
    if (!job || (job.status !== 'uploading' && job.status !== 'done')) return null;
    const activeSelection = job.selection.filter((s) => !s.isIgnored && s.episodeId);
    const totalFiles = activeSelection.length || job.entries.length;
    const parsed = parseUploadStage(job.stage);
    const percent =
      job.bytesTotal && job.bytesTotal > 0
        ? Math.round((job.bytesDone / job.bytesTotal) * 100)
        : job.status === 'done' ? 100 : 0;
    return {
      currentIndex: parsed.currentIndex ?? (job.status === 'done' ? totalFiles : Math.min(1, totalFiles)),
      totalFiles,
      activeFilename: parsed.activeFilename ?? activeSelection[0]?.filename ?? job.entries[0]?.filename ?? null,
      percent,
      loaded: job.bytesDone,
      total: job.bytesTotal,
    };
  }, [job]);

  const commitCompletedCount = useMemo(() => {
    if (!job) return 0;
    if (job.status === 'done') {
      return job.selection.length > 0
        ? job.selection.filter((s) => !s.isIgnored).length
        : totalCount;
    }
    return job.selection.filter((s) => s.completed && !s.isIgnored).length;
  }, [job, totalCount]);
  const progressPercentage = useMemo(() => {
    if (!job) return 0;
    if (job.status === 'done') return 100;
    if (job.bytesTotal && job.bytesTotal > 0) {
      return Math.round((job.bytesDone / job.bytesTotal) * 100);
    }
    return 0;
  }, [job]);

  const activeCommitItem = useMemo(
    () => effectiveReviewItems.find((i) => i.commitStatus === 'uploading') ?? null,
    [effectiveReviewItems]
  );

  const selectedProviderName =
    storageProviders.find((p) => p.id === selectedStorageProviderId)?.name ?? null;

  // ─── Cancel & reset ─────────────────────────────────────────────────────────
  const cancelAndCleanup = useCallback(async () => {
    await cancelJob();
  }, [cancelJob]);

  const reset = useCallback(() => {
    // Best-effort server cancel without touching local state afterwards —
    // reset clears the job synchronously for modal close.
    const sid = optionsRef.current?.seriesId;
    const currentJobId = jobIdRef.current;
    if (sid && currentJobId) {
      void cancelArchiveIngestJob(sid, currentJobId).catch(() => {});
    }
    jobIdRef.current = null;
    setJob(null);
    setJobError(null);
    setReviewOverrides({});
    setStepOverride(1);
    setArchiveUrl('');
    setArchivePassword('');
    setArchiveReferer('');
    setDefaultLabel('S3 Video');
    setIsSubmitting(false);

    const currentSeasonOptions = getSeasonOptions(
      optionsRef.current?.seasons,
      optionsRef.current?.localEpisodes
    );
    setSelectedSeasonId(currentSeasonOptions[0]?.id ?? '');
    setSelectedStorageProviderId(defaultProvider?.id ?? '');
  }, [defaultProvider]);

  // ─── Legacy preview-phase mapping (modal compat) ────────────────────────────
  const previewPhase: ArchivePreviewPhase =
    jobStatus === 'downloading' || jobStatus === 'queued'
      ? 'downloading'
      : jobStatus === 'listing'
        ? 'extracting'
        : jobStatus === 'ready'
          ? 'done'
          : jobStatus === 'failed' || jobStatus === 'cancelled' || jobStatus === 'expired'
            ? 'error'
            : 'idle';
  const previewError = jobError ?? job?.errorMessage ?? null;
  const stagingSessionId = jobId;
  const isCommitting = jobStatus === 'uploading' || isSubmitting;

  return {
    // Durable job state
    job,
    jobId,
    jobStatus,
    jobError,
    jobErrorCode,
    isJobActive,
    isPolling,
    isSubmitting,
    needsPassword: jobStatus === 'failed' && isPasswordErrorCode(jobErrorCode),
    sizeAnomalyFilenames,
    uploadView,
    downloadProgress,
    extractProgress,

    // Actions
    startJob,
    confirmSelection,
    cancelJob,
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
    reviewItems: effectiveReviewItems,
    updateReviewMapping,
    updateReviewLabel,
    updateReviewQuality,
    toggleReviewIgnore,
    totalCount,
    matchedCount,
    needsReviewCount,

    // Commit (legacy-mapped)
    isCommitting,
    commitCompletedCount,
    progressPercentage,
    activeCommitItem,
    startCommit: confirmSelection,

    // Cancel & lifecycle
    cancelAndCleanup,
    reset,
  };
}
