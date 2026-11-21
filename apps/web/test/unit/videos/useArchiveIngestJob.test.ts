import { renderHook, createTestQueryClient } from '../../utils';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useArchiveIngestJob } from '@/modules/videos/internal/ingestion/bulk/hooks/useArchiveIngestJob';
import {
  ARCHIVE_POLL_DELAY_MS,
  ARCHIVE_SESSION_EXPIRED_MESSAGE,
} from '@/modules/videos/internal/ingestion/bulk/hooks/archiveIngestUtils';
import type { ArchiveIngestJob } from '@repo/contracts';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonErr(status: number, message: string, code?: string): Response {
  return new Response(JSON.stringify({ error: { message, code } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeJob(overrides: Partial<ArchiveIngestJob> = {}): ArchiveIngestJob {
  return {
    id: 'job-1',
    ownerId: 'owner-1',
    seriesId: 'series-1',
    sourceKey: 'https://example.com/pack.zip',
    sourceUrl: 'https://example.com/pack.zip',
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

describe('useArchiveIngestJob hook', () => {
  let fetchHandler: (
    url: string,
    init?: RequestInit
  ) => Promise<Response> | Response;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    fetchHandler = async () => jsonOk({});

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return fetchHandler(url, init);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with idle state and no active job', () => {
    const { result } = renderHook(
      () => useArchiveIngestJob({ seriesId: 'series-1' }),
      { wrapper: createWrapper() }
    );
    expect(result.current.job).toBeNull();
    expect(result.current.jobId).toBeNull();
    expect(result.current.jobStatus).toBe('idle');
    expect(result.current.isPolling).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('handles startJob submission and validation', async () => {
    const downloading = makeJob({
      status: 'downloading',
      bytesDone: 50,
      bytesTotal: 500,
    });
    fetchHandler = async () => jsonOk(downloading);

    const { result } = renderHook(
      () => useArchiveIngestJob({ seriesId: 'series-1' }),
      { wrapper: createWrapper() }
    );

    // Empty URL should return null
    let res: ArchiveIngestJob | null = null;
    await act(async () => {
      res = await result.current.startJob({ sourceUrl: '' });
    });
    expect(res).toBeNull();

    // Valid URL creates job
    await act(async () => {
      res = await result.current.startJob({
        sourceUrl: 'https://example.com/pack.zip',
        storageProviderId: 'prov-1',
      });
    });
    expect(res).toEqual(downloading);
    expect(result.current.jobStatus).toBe('downloading');
    expect(result.current.downloadProgress).toEqual({
      loaded: 50,
      total: 500,
      percent: 10,
    });
    expect(result.current.isPolling).toBe(true);
  });

  it('cancels job and resets polling', async () => {
    const downloading = makeJob({ status: 'downloading' });
    const cancelled = makeJob({ status: 'cancelled' });
    fetchHandler = async (url, init) => {
      if (init?.method === 'POST' && url.includes('/cancel')) {
        return jsonOk(cancelled);
      }
      return jsonOk(downloading);
    };

    const { result } = renderHook(
      () => useArchiveIngestJob({ seriesId: 'series-1' }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.startJob({
        sourceUrl: 'https://example.com/pack.zip',
      });
    });
    expect(result.current.isPolling).toBe(true);

    await act(async () => {
      await result.current.cancelJob();
    });
    expect(result.current.jobStatus).toBe('cancelled');
    expect(result.current.isPolling).toBe(false);
  });

  it('handles terminal 401 polling error by halting polling and surfacing session error', async () => {
    const downloading = makeJob({ status: 'downloading' });
    fetchHandler = async (_url, init) => {
      if (init?.method === 'POST') return jsonOk(downloading);
      return jsonErr(401, 'Unauthorized');
    };

    const { result } = renderHook(
      () => useArchiveIngestJob({ seriesId: 'series-1' }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.startJob({
        sourceUrl: 'https://example.com/pack.zip',
      });
    });
    expect(result.current.isPolling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ARCHIVE_POLL_DELAY_MS);
    });
    expect(result.current.jobError).toBe(ARCHIVE_SESSION_EXPIRED_MESSAGE);
    expect(result.current.isPolling).toBe(false);
  });

  it('retries with password on password failure', async () => {
    const failed = makeJob({
      status: 'failed',
      errorCode: 'PASSWORD_REQUIRED',
      errorMessage: 'Password needed',
    });
    const resumed = makeJob({ status: 'downloading' });
    fetchHandler = async (url, init) => {
      if (init?.method === 'POST' && url.includes('/retry')) {
        return jsonOk(resumed);
      }
      return jsonOk(failed);
    };

    const { result } = renderHook(
      () => useArchiveIngestJob({ seriesId: 'series-1' }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.startJob({
        sourceUrl: 'https://example.com/pack.zip',
      });
    });
    expect(result.current.needsPassword).toBe(true);

    await act(async () => {
      await result.current.retryWithPassword('pass123');
    });
    expect(result.current.jobStatus).toBe('downloading');
    expect(result.current.needsPassword).toBe(false);
  });

  it('confirms job selection and enters uploading phase', async () => {
    const ready = makeJob({ status: 'ready' });
    const uploading = makeJob({
      status: 'uploading',
      stage: 'uploading 1/1: ep01.mp4',
      bytesDone: 100,
      bytesTotal: 1000,
    });
    fetchHandler = async (url, init) => {
      if (init?.method === 'POST' && url.includes('/confirm')) {
        return jsonOk(uploading);
      }
      return jsonOk(ready);
    };

    const { result } = renderHook(
      () => useArchiveIngestJob({ seriesId: 'series-1' }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.startJob({
        sourceUrl: 'https://example.com/pack.zip',
      });
    });

    await act(async () => {
      await result.current.confirmJob({
        selection: [
          {
            filename: 'ep01.mp4',
            episodeId: 'ep-1',
            label: 'Video',
            quality: '1080p',
            isIgnored: false,
          },
        ],
      });
    });

    expect(result.current.jobStatus).toBe('uploading');
    expect(result.current.progressPercentage).toBe(10);
    expect(result.current.uploadView?.activeFilename).toBe('ep01.mp4');
  });
});
