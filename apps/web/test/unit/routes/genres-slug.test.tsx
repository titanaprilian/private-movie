import { renderWithProviders, screen, waitFor } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import { setAccessToken } from '@/lib/api';

const mockCategoryFeedData = {
  hero: {
    id: 'hero-k drama',
    title: 'Crash Landing on You',
    description: 'A South Korean heiress accidentally paraglides into North Korea.',
    type: 'tv',
    posterUrl: 'https://example.com/kdrama-poster.jpg',
    backdropUrl: 'https://example.com/kdrama-banner.jpg',
    rating: 'TV-14',
    tmdbId: 201,
    tmdbSyncStatus: 'SYNCED',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    genres: [{ id: 'g-3', name: 'Korean Drama', slug: 'korean-drama' }],
    tags: ['Korean Drama', 'Romance'],
    seasonsCount: 1,
    episodesCount: 16,
  },
  rows: [
    {
      title: 'Ongoing Korean Drama',
      items: [
        {
          id: 's-202',
          title: 'Queen of Tears',
          description: 'A miraculous love story of a married couple surviving a crisis.',
          type: 'tv',
          posterUrl: 'https://example.com/qot.jpg',
          backdropUrl: null,
          rating: 'TV-14',
          tmdbId: 202,
          tmdbSyncStatus: 'SYNCED',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          genres: [{ id: 'g-3', name: 'Korean Drama', slug: 'korean-drama' }],
          seasonsCount: 1,
          episodesCount: 16,
        },
      ],
    },
  ],
};

describe('Category-scoped feed route (/genres/$slug)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock-access-token');
  });

  it('fetches category-scoped home feed when navigating to /genres/$slug', async () => {
    let requestedGenre: string | null = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('/api/genres') || url.includes('/genres')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }

      if (url.includes('/series/home-feed')) {
        const parsedUrl = new URL(url, 'http://localhost');
        requestedGenre = parsedUrl.searchParams.get('genre');

        return new Response(JSON.stringify({ data: mockCategoryFeedData }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });

    const history = createMemoryHistory({ initialEntries: ['/genres/korean-drama'] });
    const router = createRouter({ routeTree, history });

    renderWithProviders(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Crash Landing on You/i })).toBeInTheDocument();
    });

    expect(requestedGenre).toBe('korean-drama');
    expect(screen.getByRole('heading', { level: 2, name: 'Ongoing Korean Drama' })).toBeInTheDocument();
    expect(screen.getByText('Queen of Tears')).toBeInTheDocument();
  });
});
