import { describe, expect, it } from 'vitest';
import {
  computeSizeAnomalyFilenames,
  deriveArchiveStep,
  derivePreviewPhase,
  isPasswordErrorCode,
  parseUploadStage,
  pickDefaultStorageProvider,
  ARCHIVE_POLL_DELAY_MS,
  ARCHIVE_POLL_STATUSES,
  ARCHIVE_SESSION_EXPIRED_MESSAGE,
} from '@/modules/videos/internal/ingestion/bulk/hooks/archiveIngestUtils';
import type { StorageProviderItem } from '@/modules/storage';

describe('archiveIngestUtils', () => {
  describe('constants', () => {
    it('defines expected polling constants', () => {
      expect(ARCHIVE_POLL_DELAY_MS).toBe(3000);
      expect(ARCHIVE_SESSION_EXPIRED_MESSAGE).toContain('Session expired');
      expect(ARCHIVE_POLL_STATUSES.has('queued')).toBe(true);
      expect(ARCHIVE_POLL_STATUSES.has('downloading')).toBe(true);
      expect(ARCHIVE_POLL_STATUSES.has('listing')).toBe(true);
      expect(ARCHIVE_POLL_STATUSES.has('uploading')).toBe(true);
      expect(ARCHIVE_POLL_STATUSES.has('ready')).toBe(false);
    });
  });

  describe('pickDefaultStorageProvider', () => {
    const makeProvider = (
      id: string,
      isDefault: boolean,
      isEnabled: boolean
    ): StorageProviderItem => ({
      id,
      name: id,
      providerType: 'custom',
      endpoint: 'https://example.com',
      bucket: 'b',
      region: 'us-east-1',
      publicBaseUrl: 'https://example.com/b',
      accessKeyIdMasked: '****',
      forcePathStyle: false,
      storageLimitGb: 50,
      linkedSourcesCount: 0,
      isDefault,
      isEnabled,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('returns null for empty providers', () => {
      expect(pickDefaultStorageProvider([])).toBeNull();
    });

    it('picks the enabled default provider first', () => {
      const p1 = makeProvider('p1', false, true);
      const p2 = makeProvider('p2', true, true);
      expect(pickDefaultStorageProvider([p1, p2])?.id).toBe('p2');
    });

    it('falls back to the first enabled provider if no enabled default', () => {
      const p1 = makeProvider('p1', true, false);
      const p2 = makeProvider('p2', false, true);
      expect(pickDefaultStorageProvider([p1, p2])?.id).toBe('p2');
    });

    it('falls back to marked default even if disabled when no enabled providers', () => {
      const p1 = makeProvider('p1', false, false);
      const p2 = makeProvider('p2', true, false);
      expect(pickDefaultStorageProvider([p1, p2])?.id).toBe('p2');
    });

    it('falls back to first provider if none default or enabled', () => {
      const p1 = makeProvider('p1', false, false);
      const p2 = makeProvider('p2', false, false);
      expect(pickDefaultStorageProvider([p1, p2])?.id).toBe('p1');
    });
  });

  describe('isPasswordErrorCode', () => {
    it('returns true for password error codes', () => {
      expect(isPasswordErrorCode('PASSWORD_REQUIRED')).toBe(true);
      expect(isPasswordErrorCode('PASSWORD_INCORRECT')).toBe(true);
      expect(isPasswordErrorCode('OTHER_ERROR')).toBe(false);
      expect(isPasswordErrorCode(null)).toBe(false);
      expect(isPasswordErrorCode(undefined)).toBe(false);
    });
  });

  describe('computeSizeAnomalyFilenames', () => {
    it('returns empty set when fewer than 3 sized entries exist', () => {
      expect(
        computeSizeAnomalyFilenames([
          { filename: 'f1.mp4', sizeBytes: 100 },
          { filename: 'f2.mp4', sizeBytes: 200 },
        ]).size
      ).toBe(0);
    });

    it('flags entries whose size is < 0.5x or > 2x the median', () => {
      const anomalies = computeSizeAnomalyFilenames([
        { filename: 'normal1.mp4', sizeBytes: 1000 },
        { filename: 'normal2.mp4', sizeBytes: 1050 },
        { filename: 'tiny.mp4', sizeBytes: 200 },
        { filename: 'huge.mp4', sizeBytes: 5000 },
      ]);
      expect(anomalies.has('tiny.mp4')).toBe(true);
      expect(anomalies.has('huge.mp4')).toBe(true);
      expect(anomalies.has('normal1.mp4')).toBe(false);
      expect(anomalies.has('normal2.mp4')).toBe(false);
    });
  });

  describe('parseUploadStage', () => {
    it('parses fractional stage with active file', () => {
      const parsed = parseUploadStage('uploading 2/5: video.mp4');
      expect(parsed).toEqual({
        currentIndex: 2,
        totalFiles: 5,
        activeFilename: 'video.mp4',
      });
    });

    it('handles missing or malformed stage strings gracefully', () => {
      expect(parseUploadStage(null)).toEqual({
        currentIndex: null,
        totalFiles: null,
        activeFilename: null,
      });
      expect(parseUploadStage('queued')).toEqual({
        currentIndex: null,
        totalFiles: null,
        activeFilename: null,
      });
    });
  });

  describe('derivePreviewPhase', () => {
    it('maps job statuses to preview phases correctly', () => {
      expect(derivePreviewPhase('downloading')).toBe('downloading');
      expect(derivePreviewPhase('queued')).toBe('downloading');
      expect(derivePreviewPhase('listing')).toBe('extracting');
      expect(derivePreviewPhase('ready')).toBe('done');
      expect(derivePreviewPhase('failed')).toBe('error');
      expect(derivePreviewPhase('cancelled')).toBe('error');
      expect(derivePreviewPhase('expired')).toBe('error');
      expect(derivePreviewPhase('idle')).toBe('idle');
      expect(derivePreviewPhase('uploading')).toBe('idle');
    });
  });

  describe('deriveArchiveStep', () => {
    it('derives modal step from job status', () => {
      expect(deriveArchiveStep('ready')).toBe(2);
      expect(deriveArchiveStep('uploading')).toBe(3);
      expect(deriveArchiveStep('done')).toBe(3);
      expect(deriveArchiveStep('downloading')).toBe(1);
      expect(deriveArchiveStep('idle')).toBe(1);
    });
  });
});
