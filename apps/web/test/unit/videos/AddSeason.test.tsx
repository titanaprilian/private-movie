import { renderWithProviders, screen } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesDetailView } from '@/modules/videos/internal/SeriesDetailView';
import type { SeriesDetails } from '@/modules/videos/internal/api';
import { Toaster } from '@/components/ui/sonner';
import { setAccessToken } from '@/lib/api';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => {
    const href = params ? to.replace('$seriesId', params.seriesId) : to;
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

const createdSeason = {
  id: 'season-manual-1',
  seriesId: 'add-season-series',
  sourceUrl: 'manual-3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  source: 'manual',
  title: 'Season 2',
  description: null,
  posterUrl: null,
  createdAt: '2026-08-24',
  updatedAt: '2026-08-24',
  episodes: [],
};

const mockSeriesWithTwoSeasons: SeriesDetails = {
  id: 'add-season-series',
  sourceUrl: 'https://otakudesu.cloud/anime/add-season',
  source: 'otakudesu',
  title: 'Add Season Anime',
  description: 'Series overview',
  posterUrl: null,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  seasons: [
    {
      id: 'season-1-id',
      seriesId: 'add-season-series',
      sourceUrl: 'https://otakudesu.cloud/season-1',
      source: 'otakudesu',
      title: 'Season 1',
      description: null,
      posterUrl: null,
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
      episodes: [
        {
          id: 's1-ep1',
          seasonId: 'season-1-id',
          sourceUrl: 'https://otakudesu.cloud/s1-ep1',
          source: 'otakudesu',
          title: 'S1 Episode 1',
          order: 1,
          videoSources: [],
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
        },
      ],
    },
    createdSeason,
  ],
  episodes: [
    {
      id: 's1-ep1',
      seasonId: 'season-1-id',
      sourceUrl: 'https://otakudesu.cloud/s1-ep1',
      source: 'otakudesu',
      title: 'S1 Episode 1',
      order: 1,
      videoSources: [],
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
    },
  ],
};

describe('Add Season flow in SeriesDetailView', () => {
  beforeEach(() => {
    setAccessToken('test-token');
  });

  it('shows the Add Season button and creates a season via POST /series/:id/seasons', async () => {
    let createPayload: unknown = null;
    let createCalled = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/series/add-season-series/seasons') && method === 'POST') {
        createCalled = true;
        createPayload = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({ data: createdSeason }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/series/add-season-series')) {
        return new Response(
          JSON.stringify({ data: mockSeriesWithTwoSeasons }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }),
        { status: 404 }
      );
    });

    const { user } = renderWithProviders(
      <>
        <SeriesDetailView seriesId="add-season-series" />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Add Season Anime' });

    // Season tabs are rendered for the multi-season series
    expect(screen.getByRole('button', { name: 'Season 1' })).toBeInTheDocument();

    // Open the Add Season dialog
    await user.click(screen.getByRole('button', { name: /add season/i }));

    expect(
      await screen.findByRole('heading', { name: 'Add Season' })
    ).toBeInTheDocument();

    // Fill the form and submit
    await user.type(screen.getByLabelText('Title'), 'Season 2');
    await user.click(screen.getByRole('button', { name: /create season/i }));

    expect(createCalled).toBe(true);
    expect(createPayload).toEqual({ title: 'Season 2', description: null });

    // Success toast is shown and dialog closes
    expect(await screen.findByText('Season created successfully')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Add Season' })
    ).not.toBeInTheDocument();
  });
});
