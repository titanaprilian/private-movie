import { describe, expect, it, vi } from 'vitest';
import { Route } from '@/routes/admin/videos.index';
import { queryClient } from '@/lib/queryClient';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
}));

describe('videos.index route search validation', () => {
  it('validates search parameters correctly with defaults, trimmed q, genre, and tab', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validate = (Route as any).validateSearch;
    expect(typeof validate).toBe('function');

    expect(validate({})).toEqual({ page: 1, q: undefined, genre: undefined, tab: undefined });
    expect(validate({ page: '2', q: '  naruto  ', genre: '  sci-fi  ', tab: 'featured' })).toEqual({
      page: 2,
      q: 'naruto',
      genre: 'sci-fi',
      tab: 'featured',
    });
    expect(validate({ page: 1, tab: 'ongoing' })).toEqual({
      page: 1,
      q: undefined,
      genre: undefined,
      tab: 'ongoing',
    });
    expect(validate({ page: 1, tab: 'all' })).toEqual({
      page: 1,
      q: undefined,
      genre: undefined,
      tab: 'all',
    });
    expect(validate({ page: 'invalid', q: '', genre: '', tab: 'unknown' })).toEqual({
      page: 1,
      q: undefined,
      genre: undefined,
      tab: undefined,
    });
    expect(validate({ page: -5, q: '  ', genre: '   ', tab: '  featured  ' })).toEqual({
      page: 1,
      q: undefined,
      genre: undefined,
      tab: 'featured',
    });
  });
});

describe('videos.index route loader', () => {
  it('pre-fetches genres and series list query data with extracted search params including tab using queryClient.ensureQueryData', async () => {
    const ensureQueryDataSpy = vi
      .spyOn(queryClient, 'ensureQueryData')
      .mockResolvedValue({
        series: [],
        meta: { total: 0, page: 1, limit: 20 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

    // Call loader defined on Route
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (Route as any).loader({ deps: { page: 2, q: 'naruto', genre: 'sci-fi', tab: 'featured' } });

    expect(ensureQueryDataSpy).toHaveBeenCalled();
    const queryKeys = ensureQueryDataSpy.mock.calls.map((call) => call[0].queryKey);
    expect(queryKeys).toContainEqual(['genres']);
    expect(queryKeys).toContainEqual([
      'series',
      'list',
      { page: 2, q: 'naruto', genre: 'sci-fi', tab: 'featured' },
    ]);

    ensureQueryDataSpy.mockRestore();
  });
});
