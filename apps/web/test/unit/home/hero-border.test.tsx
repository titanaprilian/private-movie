import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { CinematicHome } from '@/modules/home';
import { setAccessToken } from '@/lib/api';

const mockSingleHero = {
  hero: {
    id: 'hero-aot',
    title: 'Attack on Titan: The Final Season',
    description: 'The truth outside the walls.',
    type: 'tv',
    posterUrl: 'https://example.com/poster.jpg',
    backdropUrl: 'https://example.com/banner.jpg',
    rating: 'TV-MA',
    tmdbId: 101,
    tmdbSyncStatus: 'SYNCED',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    genres: [{ id: 'g-1', name: 'Action', slug: 'action' }],
    tags: ['Featured'],
    seasonsCount: 4,
    episodesCount: 88,
  },
  rows: [{ title: 'Trending Now', items: [] }],
};

function mockFetch(data: unknown) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url.includes('/auth/refresh')) {
      return new Response(
        JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }),
        { status: 200 },
      );
    }
    if (url.includes('/series/home-feed')) {
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ data: null }), { status: 200 });
  });
}

describe('CinematicHome hero border removal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock-access-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hero slider container does not include bottom border styling', async () => {
    mockFetch(mockSingleHero);
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-slider')).toBeInTheDocument();
    });

    const slider = screen.getByTestId('hero-slider');
    expect(slider.className).not.toMatch(/border-b/);
    expect(slider).not.toHaveClass('border-b');
  });

  it('loading hero skeleton omits bottom border styling', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<CinematicHome />);

    const skeleton = screen.getByTestId('hero-skeleton');
    expect(skeleton.className).not.toMatch(/border-b/);
    expect(skeleton).not.toHaveClass('border-b');
  });

  it('empty hero state omits bottom border styling', async () => {
    mockFetch({ hero: null, rows: [{ title: 'Trending Now', items: [] }] });
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-empty')).toBeInTheDocument();
    });

    const empty = screen.getByTestId('hero-empty');
    expect(empty.className).not.toMatch(/border-b/);
    expect(empty).not.toHaveClass('border-b');
  });
});
