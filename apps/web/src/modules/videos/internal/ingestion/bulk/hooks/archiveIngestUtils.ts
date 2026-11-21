import type { StorageProviderItem } from '@/modules/storage';
import type { ArchiveJobPhase, ArchivePreviewPhase } from '../../types';

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
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  if (!median || median <= 0) return new Set();

  const flagged = new Set<string>();
  for (const entry of sized) {
    if (entry.sizeBytes < median * 0.5 || entry.sizeBytes > median * 2) {
      flagged.add(entry.filename);
    }
  }
  return flagged;
}

export function parseUploadStage(stage: string | null | undefined): {
  currentIndex: number | null;
  totalFiles: number | null;
  activeFilename: string | null;
} {
  if (!stage)
    return { currentIndex: null, totalFiles: null, activeFilename: null };
  const fraction = stage.match(/(\d+)\s*\/\s*(\d+)/);
  const afterColon = stage.includes(':')
    ? stage.slice(stage.lastIndexOf(':') + 1).trim()
    : null;
  return {
    currentIndex: fraction ? Number(fraction[1]) : null,
    totalFiles: fraction ? Number(fraction[2]) : null,
    activeFilename: afterColon || null,
  };
}

export function derivePreviewPhase(
  jobStatus: ArchiveJobPhase
): ArchivePreviewPhase {
  return jobStatus === 'downloading' || jobStatus === 'queued'
    ? 'downloading'
    : jobStatus === 'listing'
      ? 'extracting'
      : jobStatus === 'ready'
        ? 'done'
        : jobStatus === 'failed' ||
            jobStatus === 'cancelled' ||
            jobStatus === 'expired'
          ? 'error'
          : 'idle';
}

export function deriveArchiveStep(jobStatus: ArchiveJobPhase): 1 | 2 | 3 {
  return jobStatus === 'ready'
    ? 2
    : jobStatus === 'uploading' || jobStatus === 'done'
      ? 3
      : 1;
}
