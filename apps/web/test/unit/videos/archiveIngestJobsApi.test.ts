import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createArchiveIngestJob,
  getArchiveIngestJob,
  confirmArchiveIngestJob,
  cancelArchiveIngestJob,
  retryArchiveIngestJob,
} from '@/modules/videos/internal/api';
import type { ArchiveIngestJob } from '@repo/contracts';

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {},
  getAccessToken: () => 'test-token',
  getApiBaseUrl: () => 'https://api.example.test',
  extractErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  authFetch: authFetchMock,
}));

function makeJob(): ArchiveIngestJob {
  return {
    id: 'job-1',
    ownerId: 'owner-1',
    seriesId: 'series-1',
    sourceKey: 'https://example.com/pack.zip',
    sourceUrl: 'https://example.com/pack.zip',
    referer: 'https://example.com',
    status: 'downloading',
    stage: 'downloading',
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
  };
}

describe('createArchiveIngestJob referer passthrough', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: makeJob() }), { status: 200 })));
    authFetchMock.mockReset();
    authFetchMock.mockImplementation(async (url: string, init?: RequestInit) => fetch(url, init));
  });

  it('includes referer in the POST body when provided', async () => {
    await createArchiveIngestJob('series-1', {
      sourceUrl: 'https://example.com/pack.zip',
      storageProviderId: null,
      password: null,
      referer: 'https://example.com',
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      sourceUrl: 'https://example.com/pack.zip',
      referer: 'https://example.com',
    });
  });

  it('omits referer from the POST body when undefined', async () => {
    await createArchiveIngestJob('series-1', { sourceUrl: 'https://example.com/pack.zip' });

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty('referer');
  });
});

describe('archive ingest job calls use authFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: makeJob() }), { status: 200 })));
    authFetchMock.mockReset();
    authFetchMock.mockImplementation(async (url: string, init?: RequestInit) => fetch(url, init));
  });

  it('routes create/get/confirm/cancel/retry through authFetch', async () => {
    await createArchiveIngestJob('series-1', { sourceUrl: 'https://example.com/pack.zip' });
    await getArchiveIngestJob('series-1', 'job-1');
    await confirmArchiveIngestJob('series-1', 'job-1', {
      selection: [{ filename: 'f.mp4', episodeId: 'ep-1' }],
    });
    await cancelArchiveIngestJob('series-1', 'job-1');
    await retryArchiveIngestJob('series-1', 'job-1', null);

    expect(authFetchMock).toHaveBeenCalledTimes(5);
    const urls = authFetchMock.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(urls[0]).toContain('/api/series/series-1/archive-ingest/jobs');
    expect(urls[1]).toContain('/api/series/series-1/archive-ingest/jobs/job-1');
    expect(urls[2]).toContain('/jobs/job-1/confirm');
    expect(urls[3]).toContain('/jobs/job-1/cancel');
    expect(urls[4]).toContain('/jobs/job-1/retry');
  });

  it('succeeds when authFetch resolves after a 401 refresh', async () => {
    // authFetch (real impl, covered in lib/api tests) transparently refreshes
    // on 401 and retries — callers just propagate its resolved response.
    authFetchMock.mockReset();
    authFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: makeJob() }), { status: 200 })
    );
    const job = await getArchiveIngestJob('series-1', 'job-1');
    expect(authFetchMock).toHaveBeenCalledOnce();
    expect(job.id).toBe('job-1');
  });
});
