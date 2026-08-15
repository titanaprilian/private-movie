import { describe, expect, it, vi } from 'vitest';
import { Route } from '@/routes/videos.index';
import { queryClient } from '@/lib/queryClient';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
}));

describe('videos.index route loader', () => {
  it('pre-fetches episode query data using queryClient.ensureQueryData', async () => {
    const ensureQueryDataSpy = vi
      .spyOn(queryClient, 'ensureQueryData')
      .mockResolvedValueOnce({
        episodes: [],
        meta: { total: 0, page: 1, limit: 20 },
      } as any);

    // Call loader defined on Route
    await (Route as any).loader();

    expect(ensureQueryDataSpy).toHaveBeenCalled();
    const callArg = ensureQueryDataSpy.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['episodes', undefined]);

    ensureQueryDataSpy.mockRestore();
  });
});
