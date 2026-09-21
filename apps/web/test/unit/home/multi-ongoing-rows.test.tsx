import { renderWithProviders, screen, waitFor, within } from '../../utils';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { CinematicHome } from '@/modules/home';
import { setAccessToken } from '@/lib/api';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

function seriesItem(id: string, title: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title,
    description: `${title} synopsis`,
    type: 'tv',
    posterUrl: `https://example.com/${id}.jpg`,
    backdropUrl: `https://example.com/${id}-banner.jpg`,
    rating: '8.5',
    tmdbId: null,
    tmdbSyncStatus: 'SYNCED',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01'),
    genres: [{ id: 'g-1', name: 'Animation', slug: 'animation' }],
    seasonsCount: 2,
    episodesCount: 24,
    ...overrides,
  };
}

const mockMultiOngoingFeed = {
  hero: null,
  heroes: [],
  rows: [
    {
      title: 'Ongoing Animation',
      items: [seriesItem('anim-1', 'Solo Leveling'), seriesItem('anim-2', 'Frieren')],
    },
    {
      title: 'Ongoing Korean Drama',
      items: [seriesItem('kd-1', 'Squid Game')],
    },
    {
      title: 'Animation',
      items: [seriesItem('anim-3', 'Your Name')],
    },
    {
      title: 'Recently Added',
      items: [seriesItem('recent-1', 'New Arrival')],
    },
  ],
};

function mockFetchWithFeed(feed: unknown) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/auth/refresh')) {
      return new Response(
        JSON.stringify({ data: { tokens: { accessToken: 'mock-token' } } }),
        { status: 200 }
      );
    }
    if (url.includes('/series/home-feed')) {
      return new Response(JSON.stringify({ data: feed }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ data: null }), { status: 200 });
  });
}

describe('CinematicHome multi-ongoing rows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    setAccessToken('mock-access-token');
    mockFetchWithFeed(mockMultiOngoingFeed);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders each Ongoing Big Genre section heading in feed order', async () => {
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Ongoing Animation/ })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('heading', { level: 2, name: /Ongoing Korean Drama/ })
    ).toBeInTheDocument();

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent ?? '');
    expect(headings.indexOf('Ongoing Animation')).toBeLessThan(
      headings.indexOf('Ongoing Korean Drama')
    );
    expect(headings).toContain('Animation');
    expect(headings).toContain('Recently Added');
  });

  it('displays populated series cards with posters, badges, and metadata per ongoing row', async () => {
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Ongoing Korean Drama/ })
      ).toBeInTheDocument();
    });

    // Ongoing Animation row has 2 cards, Ongoing Korean Drama has 1
    const animHeading = screen.getByRole('heading', { level: 2, name: /Ongoing Animation/ });
    const animRow = animHeading.closest('div.relative.group\\/row') ?? animHeading.parentElement!;
    const animCards = within(animRow.parentElement as HTMLElement).getAllByTestId('series-card');
    // Total cards across all rows: 2 + 1 + 1 + 1 = 5
    expect(screen.getAllByTestId('series-card')).toHaveLength(5);
    expect(animCards.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText('Solo Leveling')).toBeInTheDocument();
    expect(screen.getByText('Frieren')).toBeInTheDocument();
    expect(screen.getByText('Squid Game')).toBeInTheDocument();

    // Posters
    expect(screen.getByAltText('Solo Leveling')).toHaveAttribute(
      'src',
      'https://example.com/anim-1.jpg'
    );

    // Badges: type badge, rating badge, season badge
    expect(screen.getAllByText('TV').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('S2').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('8.5').length).toBeGreaterThanOrEqual(3);
  });

  it('routes to the watch page when clicking a card in any ongoing section', async () => {
    const { user } = renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByText('Squid Game')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Squid Game'));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/watch/$seriesId',
      params: { seriesId: 'kd-1' },
    });

    mockNavigate.mockClear();
    await user.click(screen.getByText('Frieren'));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/watch/$seriesId',
      params: { seriesId: 'anim-2' },
    });
  });

  it('preserves backend order with highlighted series first and shows no highlight badge clutter', async () => {
    const orderedFeed = {
      hero: null,
      heroes: [],
      rows: [
        {
          title: 'Ongoing Anime',
          items: [
            seriesItem('anim-h1', 'Alpha One'),
            seriesItem('anim-h2', 'Alpha Two'),
            seriesItem('anim-p1', 'Beta One'),
          ],
        },
      ],
    };
    vi.restoreAllMocks();
    setAccessToken('mock-access-token');
    mockFetchWithFeed(orderedFeed);
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByText('Alpha One')).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId('series-card');
    expect(cards.map((c) => c.textContent)).toEqual([
      expect.stringContaining('Alpha One'),
      expect.stringContaining('Alpha Two'),
      expect.stringContaining('Beta One'),
    ]);

    // Curation is communicated by front-of-row positioning only — no extra badges on cards
    for (const card of cards) {
      expect(within(card).queryByText(/highlighted/i)).toBeNull();
      expect(within(card).queryByText(/curated/i)).toBeNull();
      expect(within(card).queryByText(/spotlight/i)).toBeNull();
    }
  });

  it('provides scroll buttons and snap scrolling for every ongoing row', async () => {
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Ongoing Animation/ })
      ).toBeInTheDocument();
    });

    for (const title of ['Ongoing Animation', 'Ongoing Korean Drama']) {
      expect(
        screen.getByRole('button', { name: new RegExp(`Scroll ${title} left`, 'i') })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: new RegExp(`Scroll ${title} right`, 'i') })
      ).toBeInTheDocument();
    }

    // Carousel containers use snap scrolling classes
    const containers = document.querySelectorAll('.snap-x.snap-mandatory');
    expect(containers.length).toBeGreaterThanOrEqual(2);
  });
});
