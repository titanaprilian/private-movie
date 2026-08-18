import { describe, expect, it, vi } from 'vitest';
import { Route } from '@/routes/videos.index';
import { queryClient } from '@/lib/queryClient';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
}));

describe('videos.index route search validation', () => {
  it('validates search parameters correctly with defaults and trimmed q', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validate = (Route as any).validateSearch;
    expect(typeof validate).toBe('function');

    expect(validate({})).toEqual({ page: 1, q: undefined });
    expect(validate({ page: '2', q: '  naruto  ' })).toEqual({ page: 2, q: 'naruto' });
    expect(validate({ page: 'invalid', q: '' })).toEqual({ page: 1, q: undefined });
    expect(validate({ page: -5, q: '  ' })).toEqual({ page: 1, q: undefined });
  });
});

describe('videos.index route loader', () => {
  it('pre-fetches series list query data with extracted search params using queryClient.ensureQueryData', async () => {
    const ensureQueryDataSpy = vi
      .spyOn(queryClient, 'ensureQueryData')
      .mockResolvedValueOnce({
        series: [],
        meta: { total: 0, page: 1, limit: 20 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

    // Call loader defined on Route
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (Route as any).loader({ deps: { page: 2, q: 'naruto' } });

    expect(ensureQueryDataSpy).toHaveBeenCalled();
    const callArg = ensureQueryDataSpy.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['series', 'list', { page: 2, q: 'naruto' }]);

    ensureQueryDataSpy.mockRestore();
  });
});
