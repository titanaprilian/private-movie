import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
    'aria-label'?: string;
  }) => (
    <a href={to} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useParams: () => ({ seriesId: 'series-sandbox' }),
}));

import { SeriesWatchView, type WatchSeriesDetails } from '@/modules/watch';
import { BELLOCLOUD_IFRAME_SANDBOX } from '@/lib/media';

function makeSeries(sourceUrl: string): WatchSeriesDetails {
  return {
    id: 'series-sandbox',
    title: 'Sandbox Series',
    description: null,
    type: 'tv',
    backdropUrl: null,
    posterUrl: null,
    logoUrl: null,
    isFeatured: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rating: null,
    genres: [],
    seasons: [
      {
        id: 'season-1',
        seriesId: 'series-sandbox',
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
            duration: null,
            rating: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            videoSources: [
              {
                id: 'src-1',
                episodeId: 'ep-1',
                type: 'embed',
                url: sourceUrl,
                label: 'Server A',
                quality: '1080p',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
      },
    ],
    episodes: [],
  };
}

describe('SeriesWatchView embed iframe sandbox', () => {
  it('applies the restrictive sandbox to BelloCloud embed iframes', () => {
    renderWithProviders(
      <SeriesWatchView
        series={makeSeries('https://videobello.net/embed/ZXBpc29kZTE')}
        initialEpisodeId="ep-1"
      />
    );

    const iframe = screen.getByTestId('watch-player') as HTMLIFrameElement;
    expect(iframe).toHaveAttribute('src', '/embed/ZXBpc29kZTE');
    expect(iframe).toHaveAttribute('sandbox', BELLOCLOUD_IFRAME_SANDBOX);
  });

  it('does not sandbox Vidhide embed iframes', () => {
    renderWithProviders(
      <SeriesWatchView
        series={makeSeries('https://odvidhide.com/v/abcd1234')}
        initialEpisodeId="ep-1"
      />
    );

    const iframe = screen.getByTestId('watch-player') as HTMLIFrameElement;
    expect(iframe).toHaveAttribute(
      'src',
      '/api/media/proxy/odvidhide.com/v/abcd1234'
    );
    expect(iframe).not.toHaveAttribute('sandbox');
  });

  it('does not sandbox Filedon embed iframes', () => {
    renderWithProviders(
      <SeriesWatchView
        series={makeSeries('https://filedon.co/embed/sample2')}
        initialEpisodeId="ep-1"
      />
    );

    const iframe = screen.getByTestId('watch-player') as HTMLIFrameElement;
    expect(iframe).not.toHaveAttribute('sandbox');
  });
});
