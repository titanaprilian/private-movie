import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { CinematicHome } from '@/modules/home';
import { IndexPage } from '@/routes/index';
import { setAccessToken } from '@/lib/api';

const mockHomeFeedData = {
  hero: {
    id: 'hero-aot',
    title: 'Attack on Titan: The Final Season',
    description: 'The truth outside the walls and the identity of the Titans have been revealed.',
    type: 'tv',
    posterUrl: 'https://example.com/poster.jpg',
    backdropUrl: 'https://example.com/banner.jpg',
    rating: 'TV-MA',
    tmdbId: 101,
    tmdbSyncStatus: 'SYNCED',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    genres: [
      { id: 'g-1', name: 'Dark Fantasy', slug: 'dark-fantasy' },
      { id: 'g-2', name: 'Action', slug: 'action' },
    ],
    tags: ['Featured Simulcast', 'Dark Fantasy', 'Action'],
    seasonsCount: 4,
    episodesCount: 88,
  },
  rows: [
    {
      title: 'Trending Now',
      items: [
        {
          id: 's-1',
          title: 'Demon Slayer: Hashira Training Arc',
          description: 'Tanjiro undergoes rigorous training with the Hashira.',
          type: 'tv',
          posterUrl: 'https://example.com/demon.jpg',
          backdropUrl: null,
          rating: 'TV-14',
          tmdbId: 102,
          tmdbSyncStatus: 'SYNCED',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          genres: [{ id: 'g-2', name: 'Action', slug: 'action' }],
          seasonsCount: 4,
          episodesCount: 55,
        },
      ],
    },
    {
      title: 'Simulcasts',
      items: [],
    },
  ],
};

describe('CinematicHome component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock-access-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton while data is fetching', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders(<CinematicHome />);

    expect(screen.getByTestId('hero-skeleton')).toBeInTheDocument();
    expect(screen.getAllByTestId('carousel-row-skeleton').length).toBeGreaterThan(0);
  });

  it('renders error state UI when network request fails and retries on click', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
      }
      if (url.includes('/series/home-feed')) {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: { message: 'Network error' } }), { status: 500 });
        }
        return new Response(JSON.stringify({ data: mockHomeFeedData }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });

    const { user } = renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByTestId('home-feed-error')).toBeInTheDocument();
    });

    expect(screen.getByText(/Unable to Load Home Feed/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry connection/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })).toBeInTheDocument();
    });
  });

  it('renders hero section with title, synopsis, tags and quick actions when payload resolves', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
      }
      if (url.includes('/series/home-feed')) {
        return new Response(JSON.stringify({ data: mockHomeFeedData }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/truth outside the walls/i)).toBeInTheDocument();

    const playButtons = screen.getAllByRole('button', { name: /play/i });
    expect(playButtons.length).toBeGreaterThan(0);

    const myListButtons = screen.getAllByRole('button', { name: /my list/i });
    expect(myListButtons.length).toBeGreaterThan(0);
  });

  it('renders carousel categories with series cards and hover details', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
      }
      if (url.includes('/series/home-feed')) {
        return new Response(JSON.stringify({ data: mockHomeFeedData }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Trending Now' })).toBeInTheDocument();
    });

    const seriesCards = screen.getAllByTestId('series-card');
    expect(seriesCards.length).toBeGreaterThan(0);

    const subDubTags = screen.getAllByText(/SUB \| DUB/i);
    expect(subDubTags.length).toBeGreaterThan(0);
  });

  it('handles null hero gracefully when DB is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
      }
      if (url.includes('/series/home-feed')) {
        return new Response(
          JSON.stringify({
            data: {
              hero: null,
              rows: [{ title: 'Trending Now', items: [] }],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByText(/No Featured Series Available/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Trending Now' })).toBeInTheDocument();
  });

  it('scrolls carousel rows left and right on button click', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
      }
      if (url.includes('/series/home-feed')) {
        return new Response(JSON.stringify({ data: mockHomeFeedData }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });

    const { user } = renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Trending Now' })).toBeInTheDocument();
    });

    const scrollLeftBtn = screen.getByRole('button', { name: /scroll trending now left/i });
    const scrollRightBtn = screen.getByRole('button', { name: /scroll trending now right/i });

    expect(scrollLeftBtn).toBeInTheDocument();
    expect(scrollRightBtn).toBeInTheDocument();

    await user.click(scrollRightBtn);
    await user.click(scrollLeftBtn);
  });
});

describe('Index route page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock-access-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders CinematicHome layout by default', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
      }
      if (url.includes('/series/home-feed')) {
        return new Response(JSON.stringify({ data: mockHomeFeedData }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });

    renderWithProviders(<IndexPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Trending Now' })).toBeInTheDocument();
  });
});
