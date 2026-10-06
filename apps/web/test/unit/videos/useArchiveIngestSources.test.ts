import { renderHook, createTestQueryClient } from '../../utils';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  useArchiveIngestSources,
  computeSizeAnomalyFilenames,
  ARCHIVE_POLL_INTERVAL_MS,
} from '@/modules/videos/internal/useArchiveIngestSources';
import * as api from '@/modules/videos/internal/api';
import type { ArchiveIngestJob } from '@repo/contracts';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/modules/videos/internal/api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/videos/internal/api')>();
  return {
    ...actual,
    createArchiveIngestJob: vi.fn(),
    getArchiveIngestJob: vi.fn(),
    confirmArchiveIngestJob: vi.fn(),
    cancelArchiveIngestJob: vi.fn(),
    retryArchiveIngestJob: vi.fn(),
  };
});

vi.mock('@/modules/storage', () => ({
  storageProvidersQueryOptions: () => ({
    queryKey: ['storage-providers'],
    queryFn: async () => [],
  }),
}));

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

function makeJob(overrides: Partial<ArchiveIngestJob> = {}): ArchiveIngestJob {
  return {
    id: 'job-1',
    ownerId: 'owner-1',
    seriesId: 'series-1',
    sourceKey: 'https://example.com/season1.zip',
    sourceUrl: 'https://example.com/season1.zip',
    status: 'queued',
    stage: 'queued',
    bytesDone: 0,
    bytesTotal: null,
    stagingPath: null,
    archiveFilename: null,
    entries: [],
    selection: [],
    storageProviderId: null,
    errorCode: null,
    errorMessage: null,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

const localEpisodes = [
  { id: 'ep-1', title: 'Episode 1', order: 1, seasonId: 's1' },
  { id: 'ep-2', title: 'Episode 2', order: 2, seasonId: 's1' },
  { id: 'ep-3', title: 'Episode 3', order: 3, seasonId: 's1' },
];

describe('useArchiveIngestSources polling hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle with no job', () => {
    const { result } = renderHook(() => useArchiveIngestSources({ seriesId: 'series-1' }), {
      wrapper: createWrapper(),
    });
    expect(result.current.job).toBeNull();
    expect(result.current.jobStatus).toBe('idle');
    expect(result.current.isPolling).toBe(false);
    expect(result.current.step).toBe(1);
  });

  it('transitions downloading -> listing -> ready -> uploading -> done across polling updates', async () => {
    const downloading = makeJob({ status: 'downloading', stage: 'downloading', bytesDone: 100, bytesTotal: 1000 });
    const listing = makeJob({ status: 'listing', stage: 'listing' });
    const ready = makeJob({
      status: 'ready',
      stage: 'ready',
      entries: [
        { filename: 'ep01.mp4', sizeBytes: 1000, detectedEpisodeNumber: 1, quality: '1080p', needsReview: false },
        { filename: 'ep02.mp4', sizeBytes: 1000, detectedEpisodeNumber: 2, quality: '1080p', needsReview: false },
      ],
    });
    const uploading = makeJob({
      status: 'uploading',
      stage: 'uploading 1/2: ep01.mp4',
      bytesDone: 500,
      bytesTotal: 2000,
      entries: ready.entries,
      selection: [
        { filename: 'ep01.mp4', episodeId: 'ep-1', label: 'S3 Video', quality: '1080p', isIgnored: false },
        { filename: 'ep02.mp4', episodeId: 'ep-2', label: 'S3 Video', quality: '1080p', isIgnored: false },
      ],
    });
    const done = makeJob({ ...uploading, status: 'done', stage: 'done', bytesDone: 2000, bytesTotal: 2000 });

    vi.mocked(api.createArchiveIngestJob).mockResolvedValue(downloading);
    vi.mocked(api.getArchiveIngestJob)
      .mockResolvedValueOnce(listing)
      .mockResolvedValueOnce(ready)
      .mockResolvedValue(uploading);
    vi.mocked(api.confirmArchiveIngestJob).mockResolvedValue(uploading);

    const { result } = renderHook(
      () => useArchiveIngestSources({ seriesId: 'series-1', localEpisodes }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.startJob();
    });
    // URL is empty so startJob toasts and returns; set URL first
    expect(api.createArchiveIngestJob).not.toHaveBeenCalled();

    act(() => {
      result.current.setArchiveUrl('https://example.com/season1.zip');
    });
    await act(async () => {
      await result.current.startJob();
    });
    expect(result.current.jobStatus).toBe('downloading');
    expect(result.current.downloadProgress).toMatchObject({ loaded: 100, total: 1000, percent: 10 });

    // Poll -> listing
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_INTERVAL_MS);
    });
    expect(result.current.jobStatus).toBe('listing');

    // Poll -> ready (review table populated)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_INTERVAL_MS);
    });
    expect(result.current.jobStatus).toBe('ready');
    expect(result.current.step).toBe(2);
    expect(result.current.reviewItems).toHaveLength(2);
    expect(result.current.reviewItems[0].matchedEpisodeId).toBe('ep-1');
    expect(result.current.matchedCount).toBe(2);

    // Confirm -> uploading view
    await act(async () => {
      await result.current.confirmSelection();
    });
    expect(api.confirmArchiveIngestJob).toHaveBeenCalledWith(
      'series-1',
      'job-1',
      expect.objectContaining({ selection: expect.any(Array) })
    );
    expect(result.current.jobStatus).toBe('uploading');
    expect(result.current.step).toBe(3);
    expect(result.current.uploadView).toMatchObject({
      currentIndex: 1,
      totalFiles: 2,
      activeFilename: 'ep01.mp4',
    });

    // Poll while uploading resolves done
    vi.mocked(api.getArchiveIngestJob).mockResolvedValue(done);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_INTERVAL_MS);
    });
    expect(result.current.jobStatus).toBe('done');
    expect(result.current.isPolling).toBe(false);
  });

  it('cancel calls the cancel endpoint and stops polling', async () => {
    const downloading = makeJob({ status: 'downloading', bytesDone: 10, bytesTotal: 100 });
    const cancelled = makeJob({ status: 'cancelled', stage: 'cancelled' });
    vi.mocked(api.createArchiveIngestJob).mockResolvedValue(downloading);
    vi.mocked(api.cancelArchiveIngestJob).mockResolvedValue(cancelled);
    vi.mocked(api.getArchiveIngestJob).mockResolvedValue(downloading);

    const { result } = renderHook(
      () => useArchiveIngestSources({ seriesId: 'series-1' }),
      { wrapper: createWrapper() }
    );
    act(() => {
      result.current.setArchiveUrl('https://example.com/pack.zip');
    });
    await act(async () => {
      await result.current.startJob();
    });
    expect(result.current.isPolling).toBe(true);

    await act(async () => {
      await result.current.cancelJob();
    });
    expect(api.cancelArchiveIngestJob).toHaveBeenCalledWith('series-1', 'job-1');
    expect(result.current.jobStatus).toBe('cancelled');
    expect(result.current.isPolling).toBe(false);

    // Advancing timers must not trigger further polls
    const calls = vi.mocked(api.getArchiveIngestJob).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_INTERVAL_MS * 3);
    });
    expect(vi.mocked(api.getArchiveIngestJob).mock.calls.length).toBe(calls);
  });

  it('password retry submits the password to the retry endpoint and resumes polling', async () => {
    const failed = makeJob({
      status: 'failed',
      stage: 'failed',
      errorCode: 'PASSWORD_REQUIRED',
      errorMessage: 'Archive is password protected',
    });
    const resumed = makeJob({ status: 'downloading', stage: 'downloading' });
    vi.mocked(api.retryArchiveIngestJob).mockResolvedValue(resumed);

    const { result } = renderHook(
      () => useArchiveIngestSources({ seriesId: 'series-1' }),
      { wrapper: createWrapper() }
    );

    // Seed failed job via create mock
    vi.mocked(api.createArchiveIngestJob).mockResolvedValue(failed);
    act(() => {
      result.current.setArchiveUrl('https://example.com/locked.zip');
    });
    await act(async () => {
      await result.current.startJob();
    });
    expect(result.current.needsPassword).toBe(true);

    act(() => {
      result.current.setArchivePassword('s3cret');
    });
    await act(async () => {
      await result.current.retryWithPassword();
    });
    expect(api.retryArchiveIngestJob).toHaveBeenCalledWith('series-1', 'job-1', 's3cret');
    expect(result.current.jobStatus).toBe('downloading');
    expect(result.current.isPolling).toBe(true);
  });

  it('flags sibling size disparities', () => {
    const anomalies = computeSizeAnomalyFilenames([
      { filename: 'ep01.mp4', sizeBytes: 1000 },
      { filename: 'ep02.mp4', sizeBytes: 1020 },
      { filename: 'ep03.mp4', sizeBytes: 90 },
    ]);
    expect([...anomalies]).toEqual(['ep03.mp4']);
    expect(computeSizeAnomalyFilenames([]).size).toBe(0);
  });
});
