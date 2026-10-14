import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
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

const mockFeedMultipleHeroes = {
  hero: {
    id: 'hero-aot',
    title: 'Attack on Titan: The Final Season',
    description: 'Truth outside the walls.',
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
  heroes: [
    {
      id: 'hero-aot',
      title: 'Attack on Titan: The Final Season',
      description: 'Truth outside the walls.',
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
    {
      id: 'hero-jjk',
      title: 'Jujutsu Kaisen Season 2',
      description: 'Hidden inventory arc.',
      type: 'tv',
      posterUrl: 'https://example.com/jjk.jpg',
      backdropUrl: 'https://example.com/jjk-banner.jpg',
      rating: 'TV-MA',
      tmdbId: 103,
      tmdbSyncStatus: 'SYNCED',
      createdAt: new Date('2026-01-02'),
      updatedAt: new Date('2026-01-02'),
      genres: [{ id: 'g-2', name: 'Supernatural', slug: 'supernatural' }],
      tags: ['Top Pick'],
      seasonsCount: 2,
      episodesCount: 47,
    },
  ],
  rows: [{ title: 'Trending Now', items: [] }],
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
      return new Response(JSON.stringify({ data: mockFeedMultipleHeroes }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ data: null }), { status: 200 });
  });
}

describe('Hero autoplay pause while series detail dialog is open', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    setAccessToken('mock-access-token');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('pauses auto-rotation while dialog is open and resumes after close', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFeedFetch();

    const { user } = renderWithProviders(<CinematicHome />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Attack on Titan/i })
      ).toBeInTheDocument();
    });

    // Open the series detail dialog via More Info
    await user.click(screen.getByTestId('hero-more-info'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Advancing past the 6s interval must NOT change the active hero slide
    // (background content is aria-hidden while the Radix dialog is open,
    // so assert via testid rather than the heading role).
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByTestId('hero-title-text')).toHaveTextContent(
      'Attack on Titan: The Final Season'
    );

    // Close the dialog (Escape dismisses Radix dialog)
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Auto-rotation resumes: advancing by the interval cycles the slide
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(
      screen.getByRole('heading', { level: 1, name: /Jujutsu Kaisen/i })
    ).toBeInTheDocument();
  });
});
