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
} from '../../../api';
import type { ArchiveIngestJob, ArchiveIngestJobStatus } from '@repo/contracts';
import type {
  ArchiveDownloadProgress,
  ArchiveExtractProgress,
  ArchiveJobPhase,
  ArchiveUploadView,
} from '../../types';
import {
  ARCHIVE_POLL_DELAY_MS,
  ARCHIVE_POLL_STATUSES,
  ARCHIVE_SESSION_EXPIRED_MESSAGE,
  isPasswordErrorCode,
  parseUploadStage,
} from './archiveIngestUtils';

export interface UseArchiveIngestJobOptions {
  seriesId?: string;
  onSuccess?: () => void;
}

export interface StartJobInput {
  sourceUrl: string;
  storageProviderId?: string | null;
  password?: string | null;
  referer?: string | null;
}

interface ConfirmJobSelectionItem {
  filename: string;
  episodeId: string | null;
  label: string | null;
  quality: string | null;
  isIgnored: boolean;
}

export interface ConfirmJobInput {
  selection: ConfirmJobSelectionItem[];
  storageProviderId?: string | null;
}

function patchJobFromProgress(
  prev: ArchiveIngestJob,
  progress: Awaited<ReturnType<typeof getArchiveIngestJobProgress>>
): ArchiveIngestJob {
  const completedSet = new Set(progress.completedFilenames ?? []);
  return {
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

async function fetchPollUpdate(
  currentSid: string,
  currentJobId: string,
  isUploading: boolean,
  prevJob: ArchiveIngestJob | null
): Promise<ArchiveIngestJob | null> {
  if (!isUploading) {
    return getArchiveIngestJob(currentSid, currentJobId);
  }
  const progress = await getArchiveIngestJobProgress(currentSid, currentJobId);
  if (progress.status === 'done' || progress.status === 'failed') {
    try {
      return await getArchiveIngestJob(currentSid, currentJobId);
    } catch {
      return prevJob ? patchJobFromProgress(prevJob, progress) : null;
    }
  }
  return prevJob ? patchJobFromProgress(prevJob, progress) : null;
}

export function useArchiveIngestJob(options?: UseArchiveIngestJobOptions) {
  const queryClient = useQueryClient();
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const [job, setJob] = useState<ArchiveIngestJob | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pollHalted, setPollHalted] = useState(false);

  const jobId = job?.id ?? null;
  const jobStatus: ArchiveJobPhase = job?.status ?? 'idle';
  const jobErrorCode = job?.errorCode ?? null;
  const isJobActive = job ? ARCHIVE_POLL_STATUSES.has(job.status) : false;
  const isPolling =
    !!jobId &&
    !!options?.seriesId &&
    !pollHalted &&
    ARCHIVE_POLL_STATUSES.has(job?.status ?? '');
  const needsPassword =
    jobStatus === 'failed' && isPasswordErrorCode(jobErrorCode);

  // ─── Polling Refs ──────────────────────────────────────────────────────────
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

  // Reset poll halt when a new job starts
  useEffect(() => {
    setPollHalted(false);
  }, [jobId]);

  // ─── Polling Loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const sid = options?.seriesId;
    if (
      !sid ||
      !jobId ||
      pollHalted ||
      !ARCHIVE_POLL_STATUSES.has(job?.status ?? '')
    )
      return;

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
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        scheduleNext();
        return;
      }
      try {
        const currentSid = seriesIdRef.current;
        const currentJobId = jobIdRef.current;
        if (!currentSid || !currentJobId) return;
        const updated = await fetchPollUpdate(
          currentSid,
          currentJobId,
          jobStatusRef.current === 'uploading',
          jobRef.current
        );
        if (cancelled || !updated) return;
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
          setPollHalted(true);
          setJobError(ARCHIVE_SESSION_EXPIRED_MESSAGE);
          return;
        }
        setJobError(
          err instanceof Error ? err.message : 'Failed to poll job status'
        );
        scheduleNext();
      }
    };

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
  const startJob = useCallback(
    async (input: StartJobInput): Promise<ArchiveIngestJob | null> => {
      const seriesId = optionsRef.current?.seriesId ?? '';
      if (!input.sourceUrl.trim()) {
        toast.error('Archive URL required', {
          description: 'Please enter a valid archive download URL.',
        });
        return null;
      }
      setIsSubmitting(true);
      setJobError(null);
      try {
        const created = await createArchiveIngestJob(seriesId, {
          sourceUrl: input.sourceUrl.trim(),
          storageProviderId: input.storageProviderId || null,
          password: input.password?.trim() || null,
          referer: input.referer?.trim() || null,
        });
        setJob(created);
        if (created.status === 'failed' && created.errorMessage) {
          setJobError(created.errorMessage);
        }
        return created;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to start archive ingest job';
        setJobError(message);
        toast.error('Failed to start archive ingest', { description: message });
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const confirmJob = useCallback(
    async (input: ConfirmJobInput): Promise<ArchiveIngestJob | null> => {
      const seriesId = optionsRef.current?.seriesId ?? '';
      const currentJob = jobRef.current;
      if (!currentJob) {
        toast.error('No active job', {
          description: 'Submit an archive URL first.',
        });
        return null;
      }
      setIsSubmitting(true);
      try {
        const confirmed = await confirmArchiveIngestJob(
          seriesId,
          currentJob.id,
          {
            selection: input.selection,
            storageProviderId: input.storageProviderId || null,
          }
        );
        setJob(confirmed);
        return confirmed;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to confirm selection';
        setJobError(message);
        toast.error('Failed to start upload', { description: message });
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

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
      setJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'cancelled' as ArchiveIngestJobStatus,
              stage: 'cancelled',
            }
          : prev
      );
    }
  }, []);

  const retryWithPassword = useCallback(
    async (password?: string | null): Promise<ArchiveIngestJob | null> => {
      const seriesId = optionsRef.current?.seriesId ?? '';
      const currentJobId = jobIdRef.current;
      if (!seriesId || !currentJobId) return null;
      setIsSubmitting(true);
      try {
        const retried = await retryArchiveIngestJob(
          seriesId,
          currentJobId,
          password?.trim() || null
        );
        setJob(retried);
        setJobError(null);
        return retried;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to retry job';
        setJobError(message);
        toast.error('Retry failed', { description: message });
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const cancelAndCleanup = useCallback(async () => {
    await cancelJob();
  }, [cancelJob]);

  const resetJob = useCallback(() => {
    const sid = optionsRef.current?.seriesId;
    const currentJobId = jobIdRef.current;
    if (sid && currentJobId) {
      void cancelArchiveIngestJob(sid, currentJobId).catch(() => {});
    }
    jobIdRef.current = null;
    setJob(null);
    setJobError(null);
    setIsSubmitting(false);
  }, []);

  // ─── Derived Progress ───────────────────────────────────────────────────────
  const downloadProgress: ArchiveDownloadProgress | null = useMemo(() => {
    if (!job || (job.status !== 'downloading' && job.status !== 'queued'))
      return null;
    const percent =
      job.bytesTotal && job.bytesTotal > 0
        ? Math.round((job.bytesDone / job.bytesTotal) * 100)
        : null;
    return { loaded: job.bytesDone, total: job.bytesTotal, percent };
  }, [job]);

  const extractProgress: ArchiveExtractProgress | null = useMemo(() => {
    if (!job || job.status !== 'listing') return null;
    return {
      currentFile: job.stage || 'Listing archive contents…',
      totalFiles: job.entries.length || null,
    };
  }, [job]);

  const uploadView: ArchiveUploadView | null = useMemo(() => {
    if (!job || (job.status !== 'uploading' && job.status !== 'done'))
      return null;
    const activeSelection = job.selection.filter(
      (s) => !s.isIgnored && s.episodeId
    );
    const totalFiles = activeSelection.length || job.entries.length;
    const parsed = parseUploadStage(job.stage);
    const percent =
      job.bytesTotal && job.bytesTotal > 0
        ? Math.round((job.bytesDone / job.bytesTotal) * 100)
        : job.status === 'done'
          ? 100
          : 0;
    return {
      currentIndex:
        parsed.currentIndex ??
        (job.status === 'done' ? totalFiles : Math.min(1, totalFiles)),
      totalFiles,
      activeFilename:
        parsed.activeFilename ??
        activeSelection[0]?.filename ??
        job.entries[0]?.filename ??
        null,
      percent,
      loaded: job.bytesDone,
      total: job.bytesTotal,
    };
  }, [job]);

  const progressPercentage = useMemo(() => {
    if (!job) return 0;
    if (job.status === 'done') return 100;
    if (job.bytesTotal && job.bytesTotal > 0) {
      return Math.round((job.bytesDone / job.bytesTotal) * 100);
    }
    return 0;
  }, [job]);

  return {
    job,
    setJob,
    jobId,
    jobStatus,
    jobError,
    setJobError,
    jobErrorCode,
    isJobActive,
    isPolling,
    isSubmitting,
    setIsSubmitting,
    needsPassword,
    downloadProgress,
    extractProgress,
    uploadView,
    progressPercentage,
    startJob,
    confirmJob,
    cancelJob,
    retryWithPassword,
    cancelAndCleanup,
    resetJob,
  };
}
