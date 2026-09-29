import { renderWithProviders, screen, waitFor, fireEvent } from '../../utils';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { CinematicHome } from '@/modules/home';
import { setAccessToken } from '@/lib/api';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockFeed = {
  hero: null,
  heroes: [],
  rows: [
    {
      title: 'Trending Now',
      items: [
        {
          id: 's-1',
          title:
            'Demon Slayer: Hashira Training Arc With A Very Long Truncated Title',
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
        {
          id: 's-2',
          title: 'Second Series',
          description: 'Another show.',
          type: 'tv',
          posterUrl: 'https://example.com/second.jpg',
          backdropUrl: null,
          rating: '7.5',
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
      videoSources: [],
    },
  ],
};

function mockFeedFetch() {
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
        { status: 200 }
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

describe('Carousel drag-to-scroll', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    setAccessToken('mock-access-token');
    mockFeedFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scrolls the carousel track when dragged with the mouse', async () => {
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getAllByTestId('series-card').length).toBeGreaterThan(0);
    });

    const track = screen.getAllByTestId('carousel-track')[0];
    expect(track.scrollLeft).toBe(0);

    fireEvent.mouseDown(track, { clientX: 200, button: 0 });
    fireEvent.mouseMove(track, { clientX: 120 });
    fireEvent.mouseUp(track);

    expect(track.scrollLeft).toBe(80);
  });

  it('disables scroll snapping while dragging so the track follows the pointer freely', async () => {
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: 'Recently Added Episodes',
        })
      ).toBeInTheDocument();
    });

    // Use the Recently Added Episodes track (last track on the page).
    const tracks = screen.getAllByTestId('carousel-track');
    const track = tracks[tracks.length - 1];
    expect(track.className).toMatch(/snap-mandatory/);

    fireEvent.mouseDown(track, { clientX: 200, button: 0 });
    fireEvent.mouseMove(track, { clientX: 120 });

    // Snap must be off mid-drag, otherwise mandatory snapping yanks the
    // track back card-by-card and dragging feels staggered.
    expect(track.className).toMatch(/snap-none/);
    expect(track.className).not.toMatch(/snap-mandatory/);
    expect(track.scrollLeft).toBe(80);

    // Small pointer jitter keeps moving the track continuously instead of
    // jumping one card at a time.
    fireEvent.mouseMove(track, { clientX: 100 });
    expect(track.scrollLeft).toBe(100);

    fireEvent.mouseUp(track);
    expect(track.className).toMatch(/snap-mandatory/);
  });

  it('shows a grabbing cursor over the whole track while dragging', async () => {
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getAllByTestId('series-card').length).toBeGreaterThan(0);
    });

    const track = screen.getAllByTestId('carousel-track')[0];
    expect(track.className).toMatch(/cursor-grab/);

    fireEvent.mouseDown(track, { clientX: 200, button: 0 });
    fireEvent.mouseMove(track, { clientX: 120 });

    expect(track.className).toMatch(/cursor-grabbing/);

    fireEvent.mouseUp(track);
    expect(track.className).toMatch(/cursor-grab/);
  });

  it('suppresses card navigation when the pointer was dragged, but not on a plain click', async () => {
    renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getAllByTestId('series-card').length).toBeGreaterThan(0);
    });

    const track = screen.getAllByTestId('carousel-track')[0];
    const card = screen.getAllByTestId('series-card')[0];

    // Drag gesture, then the browser's trailing click must not navigate.
    fireEvent.mouseDown(track, { clientX: 200, button: 0 });
    fireEvent.mouseMove(track, { clientX: 100 });
    fireEvent.mouseUp(track);
    fireEvent.click(card);
    expect(mockNavigate).not.toHaveBeenCalled();

    // A plain click (no drag) navigates as before.
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/watch/$seriesId',
      params: { seriesId: 's-1' },
    });
  });

  it('shows the full series title in a tooltip on hover', async () => {
    const { user } = renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(screen.getAllByTestId('series-card').length).toBeGreaterThan(0);
    });

    const title = screen.getByText(
      'Demon Slayer: Hashira Training Arc With A Very Long Truncated Title'
    );
    await user.hover(title);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(
      'Demon Slayer: Hashira Training Arc With A Very Long Truncated Title'
    );
  });
});
