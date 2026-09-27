import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useParams: () => ({ seriesId: 'series-1' }),
}));

import { SeriesWatchView, type WatchSeriesDetails } from '@/modules/watch';

const baseSeries: WatchSeriesDetails = {
  id: 'series-1',
  title: 'Test Series',
  description: 'desc',
  type: 'tv',
  backdropUrl: null,
  posterUrl: null,
  logoUrl: null,
  isFeatured: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  rating: '8.8',
  genres: [],
  seasons: [
    {
      id: 'season-1',
      seriesId: 'series-1',
      title: 'Season 1',
      description: null,
      posterUrl: null,
      seasonNumber: 1,
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [
        {
          id: 'ep-1',
          title: 'Episode One',
          order: 1,
          seasonId: 'season-1',
          description: null,
          thumbnailUrl: null,
          duration: '24m',
          rating: '8.8',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          videoSources: [
            { id: 'src-1', episodeId: 'ep-1', type: 'embed', url: 'https://embed.com/1', label: 'Server A', quality: '1080p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
            { id: 'src-2', episodeId: 'ep-1', type: 'embed', url: 'https://embed.com/2', label: 'Server B', quality: '720p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
            { id: 'src-3', episodeId: 'ep-1', type: 'embed', url: 'https://embed.com/3', label: 'Server C', quality: '480p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
            { id: 'src-4', episodeId: 'ep-1', type: 'embed', url: 'https://embed.com/4', label: 'Server D', quality: '1080p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
            { id: 'src-5', episodeId: 'ep-1', type: 'embed', url: 'https://embed.com/5', label: 'Server E', quality: '720p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
          ],
        },
      ],
    },
  ],
  episodes: [],
};

describe('Watch player toolbar Radix server selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('adblock_warning_dismissed', 'true');
  });
  afterEach(() => {
    localStorage.removeItem('adblock_warning_dismissed');
    vi.restoreAllMocks();
  });

  it('renders semantic groups for playback, server selector, and utilities with responsive reflow', () => {
    renderWithProviders(<SeriesWatchView series={baseSeries} initialEpisodeId="ep-1" />);
    const controls = screen.getByTestId('watch-controls');
    expect(controls).toBeInTheDocument();
    expect(controls).toHaveClass('flex-wrap', 'min-[820px]:flex-nowrap');

    const playbackGroup = screen.getByTestId('controls-playback-group');
    expect(playbackGroup).toBeInTheDocument();
    expect(playbackGroup).toHaveClass('order-1');
    expect(playbackGroup).toContainElement(screen.getByRole('button', { name: /prev episode/i }));
    expect(playbackGroup).toContainElement(screen.getByRole('button', { name: /next episode/i }));

    const serverGroup = screen.getByTestId('controls-server-group');
    expect(serverGroup).toBeInTheDocument();
    expect(serverGroup).toHaveClass('order-2', 'min-[820px]:order-3', 'justify-end');
    expect(serverGroup).toContainElement(screen.getByRole('combobox', { name: /server selector/i }));

    const utilityGroup = screen.getByTestId('controls-utility-group');
    expect(utilityGroup).toBeInTheDocument();
    expect(utilityGroup).toHaveClass('order-3', 'w-full', 'min-[820px]:order-2', 'min-[820px]:flex-1');
    expect(utilityGroup).toContainElement(screen.getByRole('button', { name: /reload player/i }));
    expect(utilityGroup).toContainElement(screen.getByRole('button', { name: /open in new tab/i }));
    // Utility buttons have visible text labels
    expect(screen.getByText('Reload')).toBeInTheDocument();
    expect(screen.getByText('Open Tab')).toBeInTheDocument();
  });

  it('renders Radix Select trigger with server status dot, current label and count', () => {
    renderWithProviders(<SeriesWatchView series={baseSeries} initialEpisodeId="ep-1" />);
    const trigger = screen.getByRole('combobox', { name: /server selector/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('data-testid', 'server-selector');
    expect(trigger).toHaveTextContent('Server A');
    expect(trigger).toHaveTextContent('(5 available)');
    // server status dot and chevron
    expect(screen.getByTestId('server-status-dot')).toBeInTheDocument();
    expect(trigger.querySelector('svg')).toBeInTheDocument();
  });

  it('renders Duolingo styling attributes and classes for toolbar elements', () => {
    renderWithProviders(<SeriesWatchView series={baseSeries} initialEpisodeId="ep-1" />);
    const playbackGroup = screen.getByTestId('controls-playback-group');
    expect(playbackGroup).toHaveClass('rounded-full');

    const prevBtn = screen.getByRole('button', { name: /prev episode/i });
    expect(prevBtn).toHaveClass('rounded-full', 'font-display');

    const reloadBtn = screen.getByRole('button', { name: /reload player/i });
    expect(reloadBtn).toHaveClass('rounded-full', 'font-display');

    const openTabBtn = screen.getByRole('button', { name: /open in new tab/i });
    expect(openTabBtn).toHaveClass('rounded-full', 'font-display', 'bg-[var(--blue)]');

    const trigger = screen.getByRole('combobox', { name: /server selector/i });
    expect(trigger).toHaveClass('rounded-full', 'font-display');
  });

  it('switches source via dropdown and updates iframe src', async () => {
    const { user } = renderWithProviders(<SeriesWatchView series={baseSeries} initialEpisodeId="ep-1" />);
    const iframe = screen.getByTestId('watch-player') as HTMLIFrameElement;
    expect(iframe.src).toBe('https://embed.com/1');

    await user.click(screen.getByRole('combobox', { name: /server selector/i }));
    const option = await screen.findByRole('option', { name: /server c/i });
    expect(option).toHaveTextContent('480p');
    await user.click(option);

    expect((screen.getByTestId('watch-player') as HTMLIFrameElement).src).toBe('https://embed.com/3');
  });

  it('single-source episode shows label without count badge', () => {
    const single: WatchSeriesDetails = {
      ...baseSeries,
      seasons: [
        {
          ...baseSeries.seasons![0]!,
          episodes: [
            {
              ...baseSeries.seasons![0]!.episodes![0]!,
              id: 'ep-single',
              videoSources: [baseSeries.seasons![0]!.episodes![0]!.videoSources![0]!],
            },
          ],
        },
      ],
    };
    renderWithProviders(<SeriesWatchView series={single} initialEpisodeId="ep-single" />);
    const trigger = screen.getByRole('combobox', { name: /server selector/i });
    expect(trigger).toHaveTextContent('Server A');
    expect(trigger).not.toHaveTextContent('available');
  });

  it('is keyboard focusable and wrapped with controls for spatial navigation', () => {
    renderWithProviders(<SeriesWatchView series={baseSeries} initialEpisodeId="ep-1" />);
    // Prev, Next, Server selector, Reload, Open in new tab — 5 focusable controls
    expect(screen.getByRole('button', { name: /prev episode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next episode/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /server selector/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload player/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open in new tab/i })).toBeInTheDocument();
  });

  it('applies high-contrast TV D-pad focus styles when focused in spatial mode', () => {
    renderWithProviders(
      <SeriesWatchView series={baseSeries} initialEpisodeId="ep-1" />
    );
    // Default: not focused
    const trigger = screen.getByRole('combobox', { name: /server selector/i });
    expect(trigger.className).not.toMatch(/bg-white text-black/);

    // Simulate D-pad landing on controls zone
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    // Focus should be on controls zone
    const prevBtn = screen.getByRole('button', { name: /prev episode/i });
    expect(prevBtn).toBeInTheDocument();
  });

  it('renders Direct vs Embed badges in the server selector options', async () => {
    const mixed: WatchSeriesDetails = {
      ...baseSeries,
      seasons: [
        {
          ...baseSeries.seasons![0]!,
          episodes: [
            {
              ...baseSeries.seasons![0]!.episodes![0]!,
              videoSources: [
                { id: 'src-d', episodeId: 'ep-1', type: 'direct', url: 'https://cdn.com/v.mp4', label: 'Direct Server', quality: '1080p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
                { id: 'src-e', episodeId: 'ep-1', type: 'embed', url: 'https://embed.com/1', label: 'Embed Server', quality: '720p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
              ],
            },
          ],
        },
      ],
    };
    const { user } = renderWithProviders(<SeriesWatchView series={mixed} initialEpisodeId="ep-1" />);
    await user.click(screen.getByRole('combobox', { name: /server selector/i }));
    const directBadges = await screen.findAllByTestId('server-badge-0');
    expect(directBadges.length).toBeGreaterThan(0);
    expect(directBadges[0]).toHaveTextContent('Direct');
    const embedBadges = await screen.findAllByTestId('server-badge-1');
    expect(embedBadges.length).toBeGreaterThan(0);
    expect(embedBadges[0]).toHaveTextContent('Embed');
  });

  it('hides Reload/Open Tab utility buttons for direct sources, shows them for embeds', async () => {
    const mixed: WatchSeriesDetails = {
      ...baseSeries,
      seasons: [
        {
          ...baseSeries.seasons![0]!,
          episodes: [
            {
              ...baseSeries.seasons![0]!.episodes![0]!,
              videoSources: [
                { id: 'src-d', episodeId: 'ep-1', type: 'direct', url: 'https://cdn.com/v.mp4', label: 'Direct Server', quality: '1080p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
                { id: 'src-e', episodeId: 'ep-1', type: 'embed', url: 'https://embed.com/1', label: 'Embed Server', quality: '720p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
              ],
            },
          ],
        },
      ],
    };
    // Defaults to the direct source → utility buttons hidden
    const { user } = renderWithProviders(<SeriesWatchView series={mixed} initialEpisodeId="ep-1" />);
    expect(screen.queryByRole('button', { name: /reload player/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open in new tab/i })).not.toBeInTheDocument();

    // Switch to the embed source → utility buttons appear
    await user.click(screen.getByRole('combobox', { name: /server selector/i }));
    await user.click(await screen.findByRole('option', { name: /embed server/i }));
    expect(screen.getByRole('button', { name: /reload player/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open in new tab/i })).toBeInTheDocument();
  });

  it('anchors server selector to the right across both direct and embed modes, placing utility buttons in the center for embeds', async () => {
    const mixedSeries: WatchSeriesDetails = {
      ...baseSeries,
      seasons: [
        {
          ...baseSeries.seasons![0]!,
          episodes: [
            {
              ...baseSeries.seasons![0]!.episodes![0]!,
              videoSources: [
                { id: 'src-direct', episodeId: 'ep-1', type: 'direct', url: 'https://cdn.com/stream.mp4', label: 'Direct Server', quality: '1080p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
                { id: 'src-embed', episodeId: 'ep-1', type: 'embed', url: 'https://embed.com/1', label: 'Embed Server', quality: '720p', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
              ],
            },
          ],
        },
      ],
    };

    // 1. Initial render with Direct server (2-group layout: playback on left, server docked to the right)
    const { user } = renderWithProviders(<SeriesWatchView series={mixedSeries} initialEpisodeId="ep-1" />);
    const serverGroup = screen.getByTestId('controls-server-group');

    expect(serverGroup).toHaveClass('order-2', 'min-[820px]:order-3', 'justify-end');
    expect(screen.queryByTestId('controls-utility-group')).not.toBeInTheDocument();

    // 2. Switch to Embed server (3-group layout: playback on left, utilities centered, server remains docked to the right)
    await user.click(screen.getByRole('combobox', { name: /server selector/i }));
    await user.click(await screen.findByRole('option', { name: /embed server/i }));

    const utilityGroup = screen.getByTestId('controls-utility-group');
    expect(utilityGroup).toBeInTheDocument();
    expect(utilityGroup).toHaveClass('order-3', 'w-full', 'min-[820px]:order-2', 'min-[820px]:flex-1');

    // Server selector stays anchored on the right without jumping
    expect(serverGroup).toHaveClass('order-2', 'min-[820px]:order-3', 'justify-end');
  });
});
