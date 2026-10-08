import { renderHook, createTestQueryClient, waitFor } from '../../utils';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  useArchiveIngestSources,
  computeSizeAnomalyFilenames,
  ARCHIVE_POLL_DELAY_MS,
  ARCHIVE_SESSION_EXPIRED_MESSAGE,
} from '@/modules/videos/internal/ingestion/useArchiveIngestSources';
import * as api from '@/modules/videos/internal/api';
import type { ArchiveIngestJob, StorageProviderItem } from '@repo/contracts';

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
    getArchiveIngestJobProgress: vi.fn(),
    confirmArchiveIngestJob: vi.fn(),
    cancelArchiveIngestJob: vi.fn(),
    retryArchiveIngestJob: vi.fn(),
  };
});

const providersFixture = vi.hoisted(() => ({ current: [] as StorageProviderItem[] }));

vi.mock('@/modules/storage', () => ({
  storageProvidersQueryOptions: () => ({
    queryKey: ['storage-providers'],
    queryFn: async () => providersFixture.current,
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
    referer: null,
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
    providersFixture.current = [];
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
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS);
    });
    expect(result.current.jobStatus).toBe('listing');

    // Poll -> ready (review table populated)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS);
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

    // Poll while uploading resolves done (lightweight progress + terminal full fetch)
    vi.mocked(api.getArchiveIngestJobProgress).mockResolvedValue({
      id: 'job-1',
      status: 'done',
      stage: 'done',
      bytesDone: 2000,
      bytesTotal: 2000,
      completedFilenames: ['ep01.mp4', 'ep02.mp4'],
      activeFilename: null,
      errorCode: null,
      errorMessage: null,
    });
    vi.mocked(api.getArchiveIngestJob).mockResolvedValue(done);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS);
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
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS * 3);
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

  it('startJob sends the referer field when filled', async () => {
    const downloading = makeJob({ status: 'downloading', stage: 'downloading' });
    vi.mocked(api.createArchiveIngestJob).mockResolvedValue(downloading);
    vi.mocked(api.getArchiveIngestJob).mockResolvedValue(downloading);

    const { result } = renderHook(
      () => useArchiveIngestSources({ seriesId: 'series-1' }),
      { wrapper: createWrapper() }
    );
    act(() => {
      result.current.setArchiveUrl('https://example.com/pack.zip');
      result.current.setArchiveReferer('https://example.com/page');
    });
    await act(async () => {
      await result.current.startJob();
    });
    expect(api.createArchiveIngestJob).toHaveBeenCalledWith(
      'series-1',
      expect.objectContaining({
        sourceUrl: 'https://example.com/pack.zip',
        referer: 'https://example.com/page',
      })
    );
  });

  it('polls sequentially with a delay after each response resolves', async () => {
    const downloading = makeJob({ status: 'downloading', stage: 'downloading' });
    vi.mocked(api.createArchiveIngestJob).mockResolvedValue(downloading);
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

    // No poll before the delay elapses.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS - 1);
    });
    expect(vi.mocked(api.getArchiveIngestJob)).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(vi.mocked(api.getArchiveIngestJob)).toHaveBeenCalledTimes(1);

    // The second poll waits for another full delay after the first resolved.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS - 1);
    });
    expect(vi.mocked(api.getArchiveIngestJob)).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(vi.mocked(api.getArchiveIngestJob)).toHaveBeenCalledTimes(2);
  });

  it('pauses polling while the tab is hidden and polls promptly when visible', async () => {
    const downloading = makeJob({ status: 'downloading', stage: 'downloading' });
    vi.mocked(api.createArchiveIngestJob).mockResolvedValue(downloading);
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

    const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS * 3);
      });
      expect(vi.mocked(api.getArchiveIngestJob)).not.toHaveBeenCalled();

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(vi.mocked(api.getArchiveIngestJob)).toHaveBeenCalledTimes(1);
    } finally {
      if (descriptor) Object.defineProperty(document, 'visibilityState', descriptor);
    }
  });

  it('halts polling and surfaces session expiry on terminal 401', async () => {
    const downloading = makeJob({ status: 'downloading', stage: 'downloading' });
    vi.mocked(api.createArchiveIngestJob).mockResolvedValue(downloading);
    vi.mocked(api.getArchiveIngestJob).mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 })
    );

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
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS);
    });
    expect(vi.mocked(api.getArchiveIngestJob)).toHaveBeenCalledTimes(1);
    expect(result.current.jobError).toBe(ARCHIVE_SESSION_EXPIRED_MESSAGE);
    expect(result.current.isPolling).toBe(false);

    // No further polls after the halt.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS * 3);
    });
    expect(vi.mocked(api.getArchiveIngestJob)).toHaveBeenCalledTimes(1);
  });

  it('polls lightweight progress during uploading and renders per-episode statuses', async () => {
    const ready = makeJob({
      status: 'ready',
      stage: 'ready',
      entries: [
        { filename: 'ep01.mp4', sizeBytes: 1000, detectedEpisodeNumber: 1, quality: '1080p', needsReview: false },
        { filename: 'ep02.mp4', sizeBytes: 1000, detectedEpisodeNumber: 2, quality: null, needsReview: true },
        { filename: 'extra.mp4', sizeBytes: 1000, detectedEpisodeNumber: null, quality: null, needsReview: true },
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
        { filename: 'ep02.mp4', episodeId: 'ep-2', label: 'Custom', quality: '720p', isIgnored: false },
        { filename: 'extra.mp4', episodeId: null, label: 'S3 Video', quality: null, isIgnored: true },
      ],
    });
    vi.mocked(api.createArchiveIngestJob).mockResolvedValue(ready);
    vi.mocked(api.confirmArchiveIngestJob).mockResolvedValue(uploading);
    vi.mocked(api.getArchiveIngestJobProgress).mockResolvedValue({
      id: 'job-1',
      status: 'uploading',
      stage: 'uploading 2/2: ep02.mp4',
      bytesDone: 1500,
      bytesTotal: 2000,
      completedFilenames: ['ep01.mp4'],
      activeFilename: 'ep02.mp4',
      errorCode: null,
      errorMessage: null,
    });

    const { result } = renderHook(
      () => useArchiveIngestSources({ seriesId: 'series-1', localEpisodes }),
      { wrapper: createWrapper() }
    );
    act(() => {
      result.current.setArchiveUrl('https://example.com/season1.zip');
    });
    await act(async () => {
      await result.current.startJob();
    });
    await act(async () => {
      await result.current.confirmSelection();
    });
    expect(result.current.jobStatus).toBe('uploading');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS);
    });
    expect(vi.mocked(api.getArchiveIngestJobProgress)).toHaveBeenCalledWith('series-1', 'job-1');
    // Full job endpoint must not be used while uploading stays active.
    expect(vi.mocked(api.getArchiveIngestJob)).not.toHaveBeenCalled();

    const byName = Object.fromEntries(result.current.reviewItems.map((i) => [i.filename, i]));
    expect(byName['ep01.mp4'].commitStatus).toBe('completed');
    expect(byName['ep02.mp4'].commitStatus).toBe('uploading');
    expect(byName['extra.mp4'].commitStatus).toBe('skipped');
    // Counter tracks completed count.
    expect(result.current.commitCompletedCount).toBe(1);
    expect(result.current.uploadView?.activeFilename).toBe('ep02.mp4');
    // User episode mapping and quality overrides preserved after merge.
    expect(byName['ep02.mp4'].matchedEpisodeId).toBe('ep-2');
    expect(byName['ep02.mp4'].quality).toBe('720p');
    expect(byName['ep02.mp4'].label).toBe('Custom');
    expect(result.current.activeCommitItem?.filename).toBe('ep02.mp4');
  });

  it('marks remaining episodes failed when the job fails and completed when done', async () => {
    const failed = makeJob({
      status: 'failed',
      stage: 'failed',
      errorCode: 'UPLOAD_FAILED',
      errorMessage: 'boom',
      entries: [
        { filename: 'ep01.mp4', sizeBytes: 1000, detectedEpisodeNumber: 1 },
        { filename: 'ep02.mp4', sizeBytes: 1000, detectedEpisodeNumber: 2 },
      ],
      selection: [
        { filename: 'ep01.mp4', episodeId: 'ep-1', isIgnored: false, completed: true },
        { filename: 'ep02.mp4', episodeId: 'ep-2', isIgnored: false, completed: false },
      ],
    });
    vi.mocked(api.createArchiveIngestJob).mockResolvedValue(failed);

    const { result } = renderHook(
      () => useArchiveIngestSources({ seriesId: 'series-1', localEpisodes }),
      { wrapper: createWrapper() }
    );
    act(() => {
      result.current.setArchiveUrl('https://example.com/pack.zip');
    });
    await act(async () => {
      await result.current.startJob();
    });
    const byName = Object.fromEntries(result.current.reviewItems.map((i) => [i.filename, i]));
    expect(byName['ep01.mp4'].commitStatus).toBe('completed');
    expect(byName['ep02.mp4'].commitStatus).toBe('failed');
    expect(result.current.commitCompletedCount).toBe(1);
  });

  it('flags sibling size disparities', () => {    const anomalies = computeSizeAnomalyFilenames([
      { filename: 'ep01.mp4', sizeBytes: 1000 },
      { filename: 'ep02.mp4', sizeBytes: 1020 },
      { filename: 'ep03.mp4', sizeBytes: 90 },
    ]);
    expect([...anomalies]).toEqual(['ep03.mp4']);
    expect(computeSizeAnomalyFilenames([]).size).toBe(0);
  });

  it('defaults selectedStorageProviderId to the active default provider', async () => {
    vi.useRealTimers();
    providersFixture.current = [
      makeStorageProvider({ id: 'prov-plain', isDefault: false, isEnabled: true }),
      makeStorageProvider({ id: 'prov-disabled-default', isDefault: true, isEnabled: false }),
      makeStorageProvider({ id: 'prov-active-default', isDefault: true, isEnabled: true }),
    ];

    const { result } = renderHook(() => useArchiveIngestSources({ seriesId: 'series-1' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.selectedStorageProviderId).toBe('prov-active-default');
    });
    expect(result.current.storageProviders).toHaveLength(3);
  });
});

function makeStorageProvider(overrides: Partial<StorageProviderItem> & { id: string }): StorageProviderItem {
  return {
    name: `Provider ${overrides.id}`,
    providerType: 'custom',
    endpoint: 'https://s3.example.com',
    region: 'us-east-1',
    bucket: 'videos',
    accessKeyIdMasked: '****',
    publicBaseUrl: null,
    forcePathStyle: false,
    storageLimitGb: 50,
    isDefault: false,
    isEnabled: true,
    linkedSourcesCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
