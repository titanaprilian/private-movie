import { renderWithProviders, screen, waitFor } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import { setAccessToken } from '@/lib/api';

const mockGenres = [
  {
    id: 'g-1',
    name: 'Action & Adventure',
    slug: 'action-and-adventure',
    isBigGenre: false,
    displayOrder: 0,
  },
  {
    id: 'g-2',
    name: 'Animation',
    slug: 'animation',
    isBigGenre: true,
    displayOrder: 1,
  },
  {
    id: 'g-3',
    name: 'Korean Drama',
    slug: 'korean-drama',
    isBigGenre: true,
    displayOrder: 2,
  },
  {
    id: 'g-4',
    name: 'Chinese Drama',
    slug: 'chinese-drama',
    isBigGenre: true,
    displayOrder: 3,
  },
];

describe('PublicNavbar component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock-access-token');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes('/api/genres') || url.includes('/genres')) {
        return new Response(JSON.stringify({ data: mockGenres }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/series/home-feed')) {
        return new Response(
          JSON.stringify({
            data: { hero: null, rows: [] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });
  });

  it('renders brand logo and navigation bar', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const router = createRouter({ routeTree, history });

    renderWithProviders(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('public-navbar')).toBeInTheDocument();
    });
    expect(screen.getByText('PRIVATE MOVIE')).toBeInTheDocument();
  });

  it('fetches genres and renders Home root link alongside sorted Big Genres', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const router = createRouter({ routeTree, history });

    renderWithProviders(<RouterProvider router={router} />);

    expect(await screen.findByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Animation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Korean Drama' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chinese Drama' })).toBeInTheDocument();

    // Standard genre (Action & Adventure) should not be in top navbar
    expect(screen.queryByRole('link', { name: 'Action & Adventure' })).not.toBeInTheDocument();
  });

  it('highlights Home as active link when at route /', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const router = createRouter({ routeTree, history });

    renderWithProviders(<RouterProvider router={router} />);

    await waitFor(() => {
      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).toHaveClass('text-white', 'font-bold');
    });
  });
});
