import { useState, useCallback, useMemo } from 'react';
import type {
  ArchiveIngestJob,
  ArchiveIngestJobEntry,
  ArchiveIngestJobStatus,
} from '@repo/contracts';
import type { ArchiveReviewItem, LocalEpisodeItem } from '../../types';
import {
  computeSizeAnomalyFilenames,
  parseUploadStage,
} from './archiveIngestUtils';

export interface UseArchiveIngestReviewOptions {
  job: ArchiveIngestJob | null;
  availableLocalEpisodes?: LocalEpisodeItem[];
  defaultLabel?: string;
}

function computeCommitStatus(
  status: ArchiveIngestJobStatus,
  isIgnored: boolean,
  isCompleted: boolean,
  filename: string,
  activeFromStage: string | null
): ArchiveReviewItem['commitStatus'] {
  if (isIgnored) return 'skipped';
  if (status === 'done') return 'completed';
  if (status === 'failed') return isCompleted ? 'completed' : 'failed';
  if (status === 'uploading') {
    return isCompleted
      ? 'completed'
      : filename === activeFromStage
        ? 'uploading'
        : 'pending';
  }
  return 'pending';
}

function resolveEpisodeMatch(
  entry: ArchiveIngestJobEntry,
  availableLocalEpisodes: LocalEpisodeItem[],
  selected?: { episodeId?: string | null; isIgnored?: boolean }
): { matchedEpisodeId: string | null; needsReview: boolean } {
  let matchedEpisodeId: string | null = null;
  let needsReview = entry.needsReview ?? true;

  if (entry.detectedEpisodeNumber != null) {
    const match = availableLocalEpisodes.find(
      (ep) => ep.order === entry.detectedEpisodeNumber
    );
    if (match) {
      matchedEpisodeId = match.id;
      needsReview = false;
    }
  }

  if (selected?.episodeId) {
    matchedEpisodeId = selected.episodeId;
    needsReview = false;
  }
  if (selected?.isIgnored) {
    needsReview = false;
  }

  return { matchedEpisodeId, needsReview };
}

function resolveCommitProgress(job: ArchiveIngestJob) {
  if (job.status !== 'uploading') return undefined;
  const percent =
    job.bytesTotal && job.bytesTotal > 0
      ? Math.round((job.bytesDone / job.bytesTotal) * 100)
      : 0;
  return {
    percent,
    loaded: job.bytesDone,
    total: job.bytesTotal,
  };
}

function buildReviewItem(
  entry: ArchiveIngestJobEntry,
  job: ArchiveIngestJob,
  availableLocalEpisodes: LocalEpisodeItem[],
  defaultLabel: string,
  anomalies: Set<string>,
  completedSet: Set<string>,
  activeFromStage: string | null
): ArchiveReviewItem {
  const selected = job.selection?.find((s) => s.filename === entry.filename);
  const { matchedEpisodeId, needsReview } = resolveEpisodeMatch(
    entry,
    availableLocalEpisodes,
    selected
  );

  const ignored = selected?.isIgnored ?? false;
  const isCompleted =
    completedSet.has(entry.filename) || selected?.completed === true;
  const commitStatus = computeCommitStatus(
    job.status,
    ignored,
    isCompleted,
    entry.filename,
    activeFromStage
  );

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
    commitProgress: resolveCommitProgress(job),
    commitError:
      job.status === 'failed' ? (job.errorMessage ?? undefined) : undefined,
    hasSizeAnomaly: anomalies.has(entry.filename),
  };
}

export function useArchiveIngestReview({
  job,
  availableLocalEpisodes = [],
  defaultLabel = 'S3 Video',
}: UseArchiveIngestReviewOptions) {
  const [reviewOverrides, setReviewOverrides] = useState<
    Record<
      string,
      {
        episodeId: string | null;
        label?: string;
        quality?: string | null;
        isIgnored?: boolean;
      }
    >
  >({});

  const reviewItems = useMemo((): ArchiveReviewItem[] => {
    if (!job || job.entries.length === 0) return [];
    const anomalies = computeSizeAnomalyFilenames(job.entries);
    const completedSet = new Set(
      job.selection.filter((s) => s.completed).map((s) => s.filename)
    );
    const activeFromStage = parseUploadStage(job.stage).activeFilename;
    return job.entries.map((entry) =>
      buildReviewItem(
        entry,
        job,
        availableLocalEpisodes,
        defaultLabel,
        anomalies,
        completedSet,
        activeFromStage
      )
    );
  }, [job, availableLocalEpisodes, defaultLabel]);

  const effectiveReviewItems = useMemo((): ArchiveReviewItem[] => {
    if (Object.keys(reviewOverrides).length === 0) return reviewItems;
    return reviewItems.map((item) => {
      const override = reviewOverrides[item.filename];
      if (!override) return item;
      const matchedEpisodeId =
        override.episodeId !== undefined
          ? override.episodeId
          : item.matchedEpisodeId;
      const isIgnored = override.isIgnored ?? item.isIgnored;
      return {
        ...item,
        matchedEpisodeId,
        isIgnored,
        needsReview: isIgnored ? false : matchedEpisodeId === null,
        label: override.label ?? item.label,
        quality:
          override.quality !== undefined ? override.quality : item.quality,
      };
    });
  }, [reviewItems, reviewOverrides]);

  const updateReviewMapping = useCallback(
    (index: number, episodeId: string | null) => {
      const filename = effectiveReviewItems[index]?.filename;
      if (!filename) return;
      setReviewOverrides((prev) => ({
        ...prev,
        [filename]: {
          episodeId,
          label: prev[filename]?.label ?? effectiveReviewItems[index]?.label,
          quality:
            prev[filename]?.quality ?? effectiveReviewItems[index]?.quality,
          isIgnored:
            prev[filename]?.isIgnored ?? effectiveReviewItems[index]?.isIgnored,
        },
      }));
    },
    [effectiveReviewItems]
  );

  const updateReviewLabel = useCallback(
    (index: number, label: string) => {
      const filename = effectiveReviewItems[index]?.filename;
      if (!filename) return;
      setReviewOverrides((prev) => ({
        ...prev,
        [filename]: {
          episodeId:
            prev[filename]?.episodeId ??
            effectiveReviewItems[index]?.matchedEpisodeId ??
            null,
          label,
          quality:
            prev[filename]?.quality ?? effectiveReviewItems[index]?.quality,
          isIgnored:
            prev[filename]?.isIgnored ?? effectiveReviewItems[index]?.isIgnored,
        },
      }));
    },
    [effectiveReviewItems]
  );

  const updateReviewQuality = useCallback(
    (index: number, quality: string) => {
      const filename = effectiveReviewItems[index]?.filename;
      if (!filename) return;
      setReviewOverrides((prev) => ({
        ...prev,
        [filename]: {
          episodeId:
            prev[filename]?.episodeId ??
            effectiveReviewItems[index]?.matchedEpisodeId ??
            null,
          label: prev[filename]?.label ?? effectiveReviewItems[index]?.label,
          quality: quality || null,
          isIgnored:
            prev[filename]?.isIgnored ?? effectiveReviewItems[index]?.isIgnored,
        },
      }));
    },
    [effectiveReviewItems]
  );

  const toggleReviewIgnore = useCallback(
    (index: number) => {
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
    },
    [effectiveReviewItems]
  );

  const resetReview = useCallback(() => {
    setReviewOverrides({});
  }, []);

  const totalCount = effectiveReviewItems.length;
  const matchedCount = useMemo(
    () =>
      effectiveReviewItems.filter(
        (i) => !i.isIgnored && i.matchedEpisodeId !== null
      ).length,
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
    () =>
      effectiveReviewItems
        .filter((i) => i.hasSizeAnomaly)
        .map((i) => i.filename),
    [effectiveReviewItems]
  );
  const activeCommitItem = useMemo(
    () =>
      effectiveReviewItems.find((i) => i.commitStatus === 'uploading') ?? null,
    [effectiveReviewItems]
  );

  const commitCompletedCount = useMemo(() => {
    if (!job) return 0;
    if (job.status === 'done') {
      return job.selection.length > 0
        ? job.selection.filter((s) => !s.isIgnored).length
        : totalCount;
    }
    return job.selection.filter((s) => s.completed && !s.isIgnored).length;
  }, [job, totalCount]);

  return {
    reviewItems: effectiveReviewItems,
    reviewOverrides,
    setReviewOverrides,
    updateReviewMapping,
    updateReviewLabel,
    updateReviewQuality,
    toggleReviewIgnore,
    resetReview,
    totalCount,
    matchedCount,
    needsReviewCount,
    sizeAnomalyFilenames,
    activeCommitItem,
    commitCompletedCount,
  };
}
