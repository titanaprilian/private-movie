import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createArchiveIngestJob } from '@/modules/videos/internal/api';
import type { ArchiveIngestJob } from '@repo/contracts';

vi.mock('@/lib/api', () => ({
  api: {},
  getAccessToken: () => 'test-token',
  getApiBaseUrl: () => 'https://api.example.test',
  extractErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
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
