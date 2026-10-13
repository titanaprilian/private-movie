import { describe, expect, it } from 'vitest';
import { Route } from '@/routes/admin/videos.index';

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
