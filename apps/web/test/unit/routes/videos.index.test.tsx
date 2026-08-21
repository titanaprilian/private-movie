import { describe, expect, it, vi } from 'vitest';
import { Route } from '@/routes/videos.index';
import { queryClient } from '@/lib/queryClient';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
}));

describe('videos.index route search validation', () => {
  it('validates search parameters correctly with defaults, trimmed q, and genre', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validate = (Route as any).validateSearch;
    expect(typeof validate).toBe('function');

    expect(validate({})).toEqual({ page: 1, q: undefined, genre: undefined });
    expect(validate({ page: '2', q: '  naruto  ', genre: '  sci-fi  ' })).toEqual({
      page: 2,
      q: 'naruto',
      genre: 'sci-fi',
    });
    expect(validate({ page: 'invalid', q: '', genre: '' })).toEqual({
      page: 1,
      q: undefined,
      genre: undefined,
    });
    expect(validate({ page: -5, q: '  ', genre: '   ' })).toEqual({
      page: 1,
      q: undefined,
      genre: undefined,
    });
  });
});

describe('videos.index route loader', () => {
  it('pre-fetches genres and series list query data with extracted search params using queryClient.ensureQueryData', async () => {
    const ensureQueryDataSpy = vi
      .spyOn(queryClient, 'ensureQueryData')
      .mockResolvedValue({
        series: [],
        meta: { total: 0, page: 1, limit: 20 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

    // Call loader defined on Route
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (Route as any).loader({ deps: { page: 2, q: 'naruto', genre: 'sci-fi' } });

    expect(ensureQueryDataSpy).toHaveBeenCalled();
    const queryKeys = ensureQueryDataSpy.mock.calls.map((call) => call[0].queryKey);
    expect(queryKeys).toContainEqual(['genres']);
    expect(queryKeys).toContainEqual([
      'series',
      'list',
      { page: 2, q: 'naruto', genre: 'sci-fi' },
    ]);

    ensureQueryDataSpy.mockRestore();
  });
});
