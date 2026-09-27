import { renderWithProviders, screen, waitFor, within } from '../../utils';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { CinematicHome } from '@/modules/home';
import { setAccessToken } from '@/lib/api';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockFeed = {
  hero: {
    id: 'hero-aot',
    title: 'Attack on Titan: The Final Season',
    description: 'The truth outside the walls.',
    type: 'tv',
    posterUrl: 'https://example.com/poster.jpg',
    backdropUrl: 'https://example.com/banner.jpg',
    rating: '9.1',
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

function mockFetch() {
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
      return new Response(JSON.stringify({ data: mockFeed }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ data: null }), { status: 200 });
  });
}

describe('Home hero showcase & series detail dialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    setAccessToken('mock-access-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('curves the hero slider bottom corners without a bottom border', async () => {
    mockFetch();
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-slider')).toBeInTheDocument();
    });

    const slider = screen.getByTestId('hero-slider');
    expect(slider).toHaveClass('rounded-b-[32px]');
    expect(slider).toHaveClass('overflow-hidden');
    expect(slider.className).not.toMatch(/border-b/);
  });

  it('renders the hero title with display typography and uppercase genre chips', async () => {
    mockFetch();
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('font-display');
    const genres = screen.getByTestId('hero-genres');
    expect(genres.className).toMatch(/uppercase/);
    expect(genres.className).toMatch(/font-bold/);
  });

  it('renders pill-shaped pagination dots for multi-slide heroes', async () => {
    const multi = {
      ...mockFeed,
      heroes: [
        mockFeed.hero,
        { ...mockFeed.hero, id: 'hero-b', title: 'Second Hero' },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url.includes('/series/home-feed')) {
        return new Response(JSON.stringify({ data: multi }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-pagination-desktop')).toBeInTheDocument();
    });

    const dots = within(screen.getByTestId('hero-pagination-desktop')).getAllByRole('button', {
      name: /go to slide/i,
    });
    for (const dot of dots) {
      expect(dot).toHaveClass('h-2', 'rounded-full');
    }
    expect(dots[0]).toHaveClass('w-6');
  });

  it('navigates to the watch page when Play is clicked', async () => {
    mockFetch();
    const { user } = renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-play')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('hero-play'));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/watch/$seriesId',
      params: { seriesId: 'hero-aot' },
    });
  });

  it('opens the detail dialog on More Info with badges, title, and close button', async () => {
    mockFetch();
    const { user } = renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-more-info')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('series-detail-dialog')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('hero-more-info'));

    const dialog = await screen.findByTestId('series-detail-dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toMatch(/rounded-\[20px\]/);
    expect(dialog.className).toMatch(/border-2/);
    expect(screen.getByTestId('series-detail-backdrop')).toHaveAttribute(
      'src',
      'https://example.com/banner.jpg',
    );
    expect(screen.getByTestId('series-detail-title')).toHaveClass('font-display');
    expect(screen.getByTestId('series-detail-title')).toHaveTextContent('Attack on Titan');
    const badges = screen.getByTestId('series-detail-badges');
    expect(badges.textContent).toMatch(/TV/);
    expect(badges.textContent).toMatch(/4 Seasons/);
    expect(badges.textContent).toMatch(/9.1/);
    expect(screen.getByTestId('series-detail-close')).toHaveClass('rounded-full');
  });

  it('routes to playback from the dialog Play Now action', async () => {
    mockFetch();
    const { user } = renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-more-info')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('hero-more-info'));
    await screen.findByTestId('series-detail-dialog');

    await user.click(screen.getByTestId('series-detail-play'));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/watch/$seriesId',
      params: { seriesId: 'hero-aot' },
    });
  });
});
