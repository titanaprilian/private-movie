import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchMinioStatus,
  minioStatusQueryOptions,
  resolveMinioStatusState,
} from '@/modules/storage/internal/api';
import { setAccessToken } from '@/lib/api';

describe('MinIO status API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('test-token');
  });

  it('fetches and parses MinIO status payload', async () => {
    const mockStatus = {
      isAvailable: true,
      isRunning: true,
      isConfigured: true,
      consoleUrl: 'http://localhost:9001',
      providerId: 'prov-1',
      endpoint: 'http://localhost:9000',
      bucket: 'private-movie-videos',
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: mockStatus }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await fetchMinioStatus();
    expect(res.isAvailable).toBe(true);
    expect(res.isRunning).toBe(true);
    expect(res.isConfigured).toBe(true);
    expect(res.providerId).toBe('prov-1');
    expect(res.bucket).toBe('private-movie-videos');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/storage/minio/status'),
      expect.any(Object)
    );
  });

  it('exposes query options with stable key and queryFn', async () => {
    const options = minioStatusQueryOptions();
    expect(options.queryKey).toEqual(['storage', 'minio', 'status']);
    expect(typeof options.queryFn).toBe('function');
  });

  it('throws with fallback message when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'boom' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await expect(fetchMinioStatus()).rejects.toThrow('boom');
  });

  describe('resolveMinioStatusState', () => {
    it('maps availability/running/configured flags to states', () => {
      expect(
        resolveMinioStatusState({ isAvailable: false, isRunning: false, isConfigured: false })
      ).toBe('unavailable');
      expect(
        resolveMinioStatusState({ isAvailable: true, isRunning: true, isConfigured: true })
      ).toBe('ready');
      expect(
        resolveMinioStatusState({ isAvailable: true, isRunning: true, isConfigured: false })
      ).toBe('not-configured');
      expect(
        resolveMinioStatusState({ isAvailable: true, isRunning: false, isConfigured: true })
      ).toBe('stopped');
      expect(
        resolveMinioStatusState({ isAvailable: true, isRunning: false, isConfigured: false })
      ).toBe('not-configured');
    });
  });
});
