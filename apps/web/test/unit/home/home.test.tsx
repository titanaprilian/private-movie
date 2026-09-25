import { renderWithProviders, screen, waitFor, within } from '../../utils';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { CinematicHome } from '@/modules/home';
import { IndexPage } from '@/routes/index';
import { setAccessToken } from '@/lib/api';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockHomeFeedDataWithMultipleHeroes = {
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
  heroes: [
    {
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
    {
      id: 'hero-jujutsu',
      title: 'Jujutsu Kaisen Season 2',
      description: 'The past comes back to haunt Gojo and Geto in the Hidden Inventory arc.',
      type: 'tv',
      posterUrl: 'https://example.com/jjk-poster.jpg',
      backdropUrl: 'https://example.com/jjk-banner.jpg',
      rating: 'TV-MA',
      tmdbId: 103,
      tmdbSyncStatus: 'SYNCED',
      createdAt: new Date('2026-01-02'),
      updatedAt: new Date('2026-01-02'),
      genres: [
        { id: 'g-3', name: 'Supernatural', slug: 'supernatural' },
        { id: 'g-2', name: 'Action', slug: 'action' },
      ],
      tags: ['Top Pick', 'Supernatural'],
      seasonsCount: 2,
      episodesCount: 47,
    },
    {
      id: 'hero-frieren',
      title: 'Frieren: Beyond Journey\'s End',
      description: 'An elf mage discovers the true meaning of time and human connections.',
      type: 'tv',
      posterUrl: 'https://example.com/frieren-poster.jpg',
      backdropUrl: 'https://example.com/frieren-banner.jpg',
      rating: 'TV-14',
      tmdbId: 104,
      tmdbSyncStatus: 'SYNCED',
      createdAt: new Date('2026-01-03'),
      updatedAt: new Date('2026-01-03'),
      genres: [
        { id: 'g-4', name: 'Fantasy', slug: 'fantasy' },
        { id: 'g-5', name: 'Adventure', slug: 'adventure' },
      ],
      tags: ['Masterpiece', 'Fantasy'],
      seasonsCount: 1,
      episodesCount: 28,
    },
  ],
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
  ],
};

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
  });

  it('renders carousel categories with series cards and simplified UI', async () => {
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

    expect(screen.getByText('S4')).toBeInTheDocument();
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('Demon Slayer: Hashira Training Arc')).toBeInTheDocument();
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

  it('does not render My List or Mute buttons in hero banner', async () => {
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

    expect(screen.queryByRole('button', { name: /my list/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mute/i })).not.toBeInTheDocument();
  });

  it('navigates hero play button and carousel cards via D-pad spatial mode focus ring', async () => {
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

    // Activate spatial mode via arrow key press
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    const heroPlayButton = screen.getByRole('button', { name: /play/i });
    expect(heroPlayButton).toHaveClass('ring-2', 'ring-white');

    // Press ArrowDown again to move focus to first carousel row card (row 1, item 0)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    expect(heroPlayButton).not.toHaveClass('ring-2');

    const firstCard = screen.getAllByTestId('series-card')[0];
    expect(firstCard).toHaveClass('ring-2', 'ring-white');

    // Deactivate spatial mode via mousemove
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });

    expect(firstCard).not.toHaveClass('ring-2');

    // Reactivate spatial mode via arrow key press (restores focus at row 1)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });

    expect(firstCard).toHaveClass('ring-2', 'ring-white');

    // Press ArrowUp again to move up to hero row 0
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });

    expect(heroPlayButton).toHaveClass('ring-2', 'ring-white');
  });

  describe('Hero Slider interactive features', () => {
    it('renders hero slider controls and pagination dots when multiple heroes are provided', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/auth/refresh')) {
          return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
        }
        if (url.includes('/series/home-feed')) {
          return new Response(JSON.stringify({ data: mockHomeFeedDataWithMultipleHeroes }), {
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

      const prevBtn = screen.getByRole('button', { name: /previous slide/i });
      const nextBtn = screen.getByRole('button', { name: /next slide/i });
      const dots = within(screen.getByTestId('hero-pagination-desktop')).getAllByRole('button', {
        name: /go to slide/i,
      });

      expect(prevBtn).toBeInTheDocument();
      expect(nextBtn).toBeInTheDocument();
      expect(dots).toHaveLength(3);
    });

    it('does not render prev/next buttons or dots when only a single hero is present', async () => {
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

      expect(screen.queryByRole('button', { name: /previous slide/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /next slide/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /go to slide/i })).not.toBeInTheDocument();
    });

    it('cycles slides via Next and Previous arrow buttons with wrap-around', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/auth/refresh')) {
          return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
        }
        if (url.includes('/series/home-feed')) {
          return new Response(JSON.stringify({ data: mockHomeFeedDataWithMultipleHeroes }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ data: null }), { status: 200 });
      });

      const { user } = renderWithProviders(<CinematicHome />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })).toBeInTheDocument();
      });

      const nextBtn = screen.getByRole('button', { name: /next slide/i });
      const prevBtn = screen.getByRole('button', { name: /previous slide/i });

      // Click next -> Jujutsu Kaisen
      await user.click(nextBtn);
      expect(screen.getByRole('heading', { level: 1, name: /Jujutsu Kaisen/i })).toBeInTheDocument();

      // Click next -> Frieren
      await user.click(nextBtn);
      expect(screen.getByRole('heading', { level: 1, name: /Frieren/i })).toBeInTheDocument();

      // Click next (wrap around) -> Attack on Titan
      await user.click(nextBtn);
      expect(screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })).toBeInTheDocument();

      // Click prev (wrap around backwards) -> Frieren
      await user.click(prevBtn);
      expect(screen.getByRole('heading', { level: 1, name: /Frieren/i })).toBeInTheDocument();
    });

    it('jumps directly to a slide when clicking pagination indicator dots', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/auth/refresh')) {
          return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
        }
        if (url.includes('/series/home-feed')) {
          return new Response(JSON.stringify({ data: mockHomeFeedDataWithMultipleHeroes }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ data: null }), { status: 200 });
      });

      const { user } = renderWithProviders(<CinematicHome />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })).toBeInTheDocument();
      });

      const dots = within(screen.getByTestId('hero-pagination-desktop')).getAllByRole('button', {
        name: /go to slide/i,
      });

      // Click dot 2 (3rd slide) -> Frieren
      await user.click(dots[2]);
      expect(screen.getByRole('heading', { level: 1, name: /Frieren/i })).toBeInTheDocument();

      // Click dot 1 (2nd slide) -> Jujutsu Kaisen
      await user.click(dots[1]);
      expect(screen.getByRole('heading', { level: 1, name: /Jujutsu Kaisen/i })).toBeInTheDocument();
    });

    it('auto-advances slides every 6 seconds and pauses on hover', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/auth/refresh')) {
          return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
        }
        if (url.includes('/series/home-feed')) {
          return new Response(JSON.stringify({ data: mockHomeFeedDataWithMultipleHeroes }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ data: null }), { status: 200 });
      });

      const { user } = renderWithProviders(<CinematicHome />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })).toBeInTheDocument();
      });

      // Advance time by 6 seconds
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      expect(screen.getByRole('heading', { level: 1, name: /Jujutsu Kaisen/i })).toBeInTheDocument();

      // Mouse enter to pause timer
      const sliderContainer = screen.getByTestId('hero-slider');
      await user.hover(sliderContainer);

      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Should still be Jujutsu Kaisen because timer was paused
      expect(screen.getByRole('heading', { level: 1, name: /Jujutsu Kaisen/i })).toBeInTheDocument();

      // Mouse unhover to resume timer
      await user.unhover(sliderContainer);

      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // Should advance to Frieren
      expect(screen.getByRole('heading', { level: 1, name: /Frieren/i })).toBeInTheDocument();

      vi.useRealTimers();
    });
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

describe('Recently Added Episodes carousel', () => {
  const mockFeedWithRecentEpisodes = {
    hero: null,
    heroes: [],
    rows: [
      {
        title: 'Trending Now',
        items: [
          {
            id: 's-1',
            title: 'Demon Slayer: Hashira Training Arc',
            description: 'Tanjiro trains with the Hashira.',
            type: 'tv',
            posterUrl: 'https://example.com/demon.jpg',
            backdropUrl: null,
            rating: '8.5',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
            genres: [],
            seasonsCount: 4,
            episodesCount: 55,
          },
        ],
      },
      {
        title: 'Recently Added',
        items: [
          {
            id: 's-legacy',
            title: 'Legacy Series Row Item',
            description: 'Old series-based row.',
            type: 'tv',
            posterUrl: 'https://example.com/legacy.jpg',
            backdropUrl: null,
            rating: '7.0',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
            genres: [],
            seasonsCount: 1,
            episodesCount: 12,
          },
        ],
      },
    ],
    recentlyAddedEpisodes: [
      {
        id: 'ep-12',
        title: 'The Final Battle',
        order: 12,
        thumbnailUrl: 'https://example.com/ep12.jpg',
        duration: 1440,
        rating: 'TV-MA',
        createdAt: new Date('2026-02-01').toISOString(),
        series: {
          id: 's-aot',
          title: 'Attack on Titan',
          posterUrl: 'https://example.com/aot-poster.jpg',
          backdropUrl: 'https://example.com/aot-backdrop.jpg',
        },
        season: {
          id: 'season-1',
          seasonNumber: 1,
          title: 'Season 1',
        },
        videoSources: [
          {
            id: 'vs-1',
            episodeId: 'ep-12',
            type: 'hls',
            url: 'https://example.com/ep12.m3u8',
            label: '1080p',
            quality: '1080p',
            createdAt: new Date('2026-02-01').toISOString(),
            updatedAt: new Date('2026-02-01').toISOString(),
          },
        ],
      },
      {
        id: 'ep-3',
        title: 'No Thumbnail Episode',
        order: 3,
        thumbnailUrl: null,
        duration: null,
        rating: null,
        createdAt: new Date('2026-01-15').toISOString(),
        series: {
          id: 's-fallback',
          title: 'Fallback Show',
          posterUrl: 'https://example.com/fallback-poster.jpg',
          backdropUrl: null,
        },
        season: {
          id: 'season-x',
          seasonNumber: null,
          title: 'Specials',
        },
        videoSources: [
          {
            id: 'vs-2',
            episodeId: 'ep-3',
            type: 'hls',
            url: 'https://example.com/ep3.m3u8',
            label: '720p',
            quality: '720p',
            createdAt: new Date('2026-01-15').toISOString(),
            updatedAt: new Date('2026-01-15').toISOString(),
          },
        ],
      },
    ],
  };

  function mockFeedFetch(feedData: unknown) {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }), { status: 200 });
      }
      if (url.includes('/series/home-feed')) {
        return new Response(JSON.stringify({ data: feedData }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    setAccessToken('mock-access-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Recently Added Episodes carousel when items are present', async () => {
    mockFeedFetch(mockFeedWithRecentEpisodes);

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Recently Added Episodes' })).toBeInTheDocument();
    });

    expect(screen.getAllByTestId('episode-card')).toHaveLength(2);
  });

  it('filters out the legacy series-based Recently Added row', async () => {
    mockFeedFetch(mockFeedWithRecentEpisodes);

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Recently Added Episodes' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 2, name: 'Trending Now' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Recently Added' })).not.toBeInTheDocument();
    expect(screen.queryByText('Legacy Series Row Item')).not.toBeInTheDocument();
  });

  it('renders 16:9 landscape cards with S{season} E{episode} badge overlay', async () => {
    mockFeedFetch(mockFeedWithRecentEpisodes);

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByText('S1 E12')).toBeInTheDocument();
    });

    // Null season number falls back to EP {order}
    expect(screen.getByText('EP 3')).toBeInTheDocument();

    const cards = screen.getAllByTestId('episode-card');
    const thumbnails = cards.map((card) => card.querySelector('[data-testid="episode-thumbnail"]'));
    for (const thumb of thumbnails) {
      expect(thumb).toHaveClass('aspect-video');
    }
  });

  it('renders episode title directly below thumbnail and series title below episode title', async () => {
    mockFeedFetch(mockFeedWithRecentEpisodes);

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByText('The Final Battle')).toBeInTheDocument();
    });

    const card = screen.getAllByTestId('episode-card')[0];
    const episodeTitle = card.querySelector('[data-testid="episode-title"]');
    const seriesTitle = card.querySelector('[data-testid="episode-series-title"]');
    expect(episodeTitle).toHaveTextContent('The Final Battle');
    expect(seriesTitle).toHaveTextContent('Attack on Titan');
    // Episode title node precedes series title node in DOM order
    expect(episodeTitle!.compareDocumentPosition(seriesTitle!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('falls back from episode thumbnail to series backdrop/poster', async () => {
    mockFeedFetch(mockFeedWithRecentEpisodes);

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getAllByTestId('episode-card')).toHaveLength(2);
    });

    const images = screen.getAllByTestId('episode-thumbnail-img');
    // First episode uses its own thumbnail
    expect(images[0]).toHaveAttribute('src', 'https://example.com/ep12.jpg');
    // Second episode has no thumbnail/backdrop -> falls back to series poster
    expect(images[1]).toHaveAttribute('src', 'https://example.com/fallback-poster.jpg');
  });

  it('uses placeholder image when episode, backdrop, and poster are all missing', async () => {
    const feed = {
      ...mockFeedWithRecentEpisodes,
      recentlyAddedEpisodes: [
        {
          ...mockFeedWithRecentEpisodes.recentlyAddedEpisodes[1],
          series: {
            id: 's-bare',
            title: 'Bare Show',
            posterUrl: null,
            backdropUrl: null,
          },
        },
      ],
    };
    mockFeedFetch(feed);

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getAllByTestId('episode-card')).toHaveLength(1);
    });

    const img = screen.getByTestId('episode-thumbnail-img');
    expect(img.getAttribute('src')).toMatch(/unsplash|placeholder/);
  });

  it('navigates to /watch/$seriesId?ep=$episodeId when an episode card is clicked', async () => {
    mockFeedFetch(mockFeedWithRecentEpisodes);

    const { user } = renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getAllByTestId('episode-card')).toHaveLength(2);
    });

    await user.click(screen.getAllByTestId('episode-card')[0]);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/watch/$seriesId',
      params: { seriesId: 's-aot' },
      search: { ep: 'ep-12' },
    });
  });

  it('omits the carousel when recentlyAddedEpisodes is empty', async () => {
    mockFeedFetch({ ...mockFeedWithRecentEpisodes, recentlyAddedEpisodes: [] });

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Trending Now' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('heading', { level: 2, name: 'Recently Added Episodes' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('episode-card')).not.toBeInTheDocument();
  });

  it('omits the carousel when recentlyAddedEpisodes is undefined', async () => {
    const feedWithoutEpisodes = { ...mockFeedWithRecentEpisodes, recentlyAddedEpisodes: undefined };
    mockFeedFetch(feedWithoutEpisodes);

    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Trending Now' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('heading', { level: 2, name: 'Recently Added Episodes' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('episode-card')).not.toBeInTheDocument();
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
