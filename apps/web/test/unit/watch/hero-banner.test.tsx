import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../utils';
import { SeriesHeroBanner } from '@/modules/watch/internal/SeriesHeroBanner';
import type { WatchSeriesDetails } from '@/modules/watch';

const baseSeries: WatchSeriesDetails = {
  id: 'series-1',
  title: 'Test Series',
  description: 'A thrilling series synopsis that sets the stage.',
  type: 'tv',
  backdropUrl: 'https://images.unsplash.com/backdrop-1',
  posterUrl: 'https://images.unsplash.com/poster-1',
  logoUrl: null,
  isFeatured: false,
  createdAt: '2024-03-15T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  rating: '8.8',
  genres: [
    { id: 'g-1', name: 'Action', slug: 'action' },
    { id: 'g-2', name: 'Fantasy', slug: 'fantasy' },
    { id: 'g-3', name: 'Drama', slug: 'drama' },
  ],
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
          videoSources: [],
        },
        {
          id: 'ep-2',
          title: 'Episode Two',
          order: 2,
          seasonId: 'season-1',
          description: null,
          thumbnailUrl: null,
          duration: '24m',
          rating: '8.8',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          videoSources: [],
        },
      ],
    },
    {
      id: 'season-2',
      seriesId: 'series-1',
      title: 'Season 2',
      description: null,
      posterUrl: null,
      seasonNumber: 2,
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [
        {
          id: 'ep-3',
          title: 'Episode Three',
          order: 1,
          seasonId: 'season-2',
          description: null,
          thumbnailUrl: null,
          duration: '24m',
          rating: '8.8',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          videoSources: [],
        },
      ],
    },
  ],
  episodes: [],
};

describe('SeriesHeroBanner cinematic layout', () => {
  const onPlay = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders full-bleed artwork with multi-stop vignette gradient overlays', () => {
    render(<SeriesHeroBanner series={baseSeries} onPlay={onPlay} onBack={onBack} />);

    expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();

    const bottom = screen.getByTestId('hero-gradient-bottom');
    expect(bottom.className).toMatch('bg-gradient-to-t');
    expect(bottom.className).toMatch('from-black');

    const left = screen.getByTestId('hero-gradient-left');
    expect(left.className).toMatch('bg-gradient-to-r');
    expect(left.className).toMatch('from-black/80');
  });

  it('keeps mobile height at 65dvh so the portrait poster has breathing room', () => {
    render(<SeriesHeroBanner series={baseSeries} onPlay={onPlay} onBack={onBack} />);

    const artwork = screen.getByTestId('hero-artwork');
    expect(artwork).toHaveClass('h-[65dvh]', 'min-h-[420px]');
    expect(artwork).toHaveClass('md:h-[85vh]', 'md:min-h-[550px]');
  });

  it('renders portrait poster on mobile and wide backdrop on desktop', () => {
    render(<SeriesHeroBanner series={baseSeries} onPlay={onPlay} onBack={onBack} />);

    const mobile = screen.getByTestId('hero-bg-mobile');
    expect(mobile).toHaveAttribute('src', baseSeries.posterUrl);
    expect(mobile.className).toMatch('md:hidden');

    const desktop = screen.getByTestId('hero-bg-desktop');
    expect(desktop).toHaveAttribute('src', baseSeries.backdropUrl);
    expect(desktop.className).toMatch('hidden');
    expect(desktop.className).toMatch('md:block');
  });

  it('falls back to backdrop on mobile when the poster is absent', () => {
    render(
      <SeriesHeroBanner
        series={{ ...baseSeries, posterUrl: null }}
        onPlay={onPlay}
        onBack={onBack}
      />
    );

    expect(screen.getByTestId('hero-bg-mobile')).toHaveAttribute(
      'src',
      baseSeries.backdropUrl
    );
    expect(screen.getByTestId('hero-bg-desktop')).toHaveAttribute(
      'src',
      baseSeries.backdropUrl
    );
  });

  it('falls back to poster on desktop when the backdrop is absent', () => {
    render(
      <SeriesHeroBanner
        series={{ ...baseSeries, backdropUrl: null }}
        onPlay={onPlay}
        onBack={onBack}
      />
    );

    expect(screen.getByTestId('hero-bg-mobile')).toHaveAttribute(
      'src',
      baseSeries.posterUrl
    );
    expect(screen.getByTestId('hero-bg-desktop')).toHaveAttribute(
      'src',
      baseSeries.posterUrl
    );
  });

  it('renders a styled dark placeholder with gradients when all artwork is absent', () => {
    render(
      <SeriesHeroBanner
        series={{ ...baseSeries, posterUrl: null, backdropUrl: null }}
        onPlay={onPlay}
        onBack={onBack}
      />
    );

    expect(screen.queryByTestId('hero-bg-mobile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-bg-desktop')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-gradient-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('hero-title-text')).toBeInTheDocument();
    expect(screen.getByTestId('hero-play')).toBeInTheDocument();
  });

  it('falls back to the secondary artwork when an image fails to load', () => {
    render(<SeriesHeroBanner series={baseSeries} onPlay={onPlay} onBack={onBack} />);

    fireEvent.error(screen.getByTestId('hero-bg-mobile'));

    // Poster failed: mobile track now shows the backdrop
    expect(screen.getByTestId('hero-bg-mobile')).toHaveAttribute(
      'src',
      baseSeries.backdropUrl
    );
  });

  it('centers overlay content on mobile and left-aligns on desktop', () => {
    render(<SeriesHeroBanner series={baseSeries} onPlay={onPlay} onBack={onBack} />);

    const content = screen.getByTestId('hero-content');
    expect(content).toHaveClass('items-center', 'text-center', 'mx-auto');
    expect(content).toHaveClass('md:items-start', 'md:text-left', 'md:mx-0');
    expect(screen.getByTestId('hero-meta')).toHaveClass(
      'justify-center',
      'md:justify-start'
    );
  });

  it('renders logo, metadata row, synopsis, and white play CTA overlaid on the artwork', () => {
    const withLogo: WatchSeriesDetails = {
      ...baseSeries,
      logoUrl: 'https://images.unsplash.com/logo-1.png',
    };
    render(<SeriesHeroBanner series={withLogo} onPlay={onPlay} onBack={onBack} />);

    // Logo overlaid and centered on mobile (title heading omitted)
    const logo = screen.getByTestId('hero-logo');
    expect(logo).toHaveAttribute('src', 'https://images.unsplash.com/logo-1.png');
    expect(logo).toHaveClass('mx-auto', 'md:mx-0', 'object-center');
    expect(screen.queryByTestId('hero-title-text')).not.toBeInTheDocument();

    // Metadata row: yellow star rating, year, season/episode counts
    const meta = screen.getByTestId('hero-meta');
    expect(meta).toBeInTheDocument();
    expect(screen.getByTestId('hero-rating')).toHaveTextContent('8.8');
    expect(screen.getByTestId('hero-rating').className).toMatch('text-yellow-400');
    expect(meta).toHaveTextContent('2024');
    expect(screen.getByTestId('hero-seasons-episodes')).toHaveTextContent('2 Seasons');
    expect(screen.getByTestId('hero-seasons-episodes')).toHaveTextContent('3 Episodes');

    // Synopsis hidden on mobile, line-clamped on desktop
    const synopsis = screen.getByTestId('hero-synopsis');
    expect(synopsis).toHaveTextContent('A thrilling series synopsis');
    expect(synopsis).toHaveClass('hidden', 'md:line-clamp-3');

    // High-contrast white play CTA, full-width on mobile
    const play = screen.getByTestId('hero-play');
    expect(play).toHaveClass('bg-white', 'text-black', 'w-full', 'md:w-auto');
    expect(play).toHaveAccessibleName(/play episode 1/i);
  });

  it('caps genres to 2 on mobile with the remainder revealed on desktop', () => {
    render(<SeriesHeroBanner series={baseSeries} onPlay={onPlay} onBack={onBack} />);

    const genres = screen.getByTestId('hero-genres');
    expect(genres).toHaveTextContent('Action');
    expect(genres).toHaveTextContent('Fantasy');
    expect(genres).toHaveTextContent('Drama');
    expect(genres).toHaveTextContent('•');

    const extra = screen.getByTestId('hero-genres-extra');
    expect(extra).toHaveTextContent('Drama');
    expect(extra).not.toHaveTextContent('Action');
    expect(extra).toHaveClass('hidden', 'md:inline-flex');
  });

  it('falls back to a centered high-contrast bold title when the logo is missing', () => {
    render(<SeriesHeroBanner series={baseSeries} onPlay={onPlay} onBack={onBack} />);

    expect(screen.queryByTestId('hero-logo')).not.toBeInTheDocument();
    const title = screen.getByTestId('hero-title-text');
    expect(title).toHaveTextContent('Test Series');
    expect(title.parentElement).toHaveClass(
      'text-center',
      'md:text-left',
      'text-white',
      'font-extrabold'
    );
  });

  it('falls back to the title when the logo fails to load', () => {
    const withBrokenLogo: WatchSeriesDetails = {
      ...baseSeries,
      logoUrl: 'https://images.unsplash.com/broken-logo.png',
    };
    render(
      <SeriesHeroBanner series={withBrokenLogo} onPlay={onPlay} onBack={onBack} />
    );

    fireEvent.error(screen.getByTestId('hero-logo'));

    expect(screen.queryByTestId('hero-logo')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-title-text')).toHaveTextContent('Test Series');
  });

  it('shows a synopsis fallback hidden on mobile when the description is missing', () => {
    render(
      <SeriesHeroBanner
        series={{ ...baseSeries, description: null }}
        onPlay={onPlay}
        onBack={onBack}
      />
    );

    const synopsis = screen.getByTestId('hero-synopsis');
    expect(synopsis).toHaveTextContent('No synopsis available for this series.');
    expect(synopsis).toHaveClass('hidden');
  });

  it('triggers playback of Episode 1 when the play CTA is clicked', () => {
    render(<SeriesHeroBanner series={baseSeries} onPlay={onPlay} onBack={onBack} />);

    fireEvent.click(screen.getByTestId('hero-play'));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('disables the play CTA when there is nothing playable', () => {
    render(
      <SeriesHeroBanner series={baseSeries} onPlay={onPlay} isPlayDisabled />
    );

    expect(screen.getByTestId('hero-play')).toBeDisabled();
  });

  it('does not embed back navigation in the hero (hoisted to the watch view shell)', () => {
    render(<SeriesHeroBanner series={baseSeries} onPlay={onPlay} onBack={onBack} />);

    // Sticky top navigation lives in WatchTopNav at the SeriesWatchView shell level
    expect(screen.queryByTestId('hero-back-bar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('applies spatial focus rings to the play control', () => {
    render(
      <SeriesHeroBanner
        series={baseSeries}
        onPlay={onPlay}
        onBack={onBack}
        isSpatialMode
        isBackFocused
        isPlayFocused
      />
    );

    expect(screen.getByTestId('hero-play')).toHaveClass('ring-2', 'ring-white');
  });

  it('omits focus rings outside spatial mode', () => {
    render(<SeriesHeroBanner series={baseSeries} onPlay={onPlay} onBack={onBack} />);

    expect(screen.getByTestId('hero-play')).not.toHaveClass('ring-2');
  });
});
