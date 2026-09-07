import { renderWithProviders, screen, userEvent } from '../../utils';
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
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
    onClick?: () => void;
  }) => {
    const href = params ? to.replace('$seriesId', params.seriesId) : to;
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  },
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

const mockSeries: SeriesDetails = {
  id: 'deep-modules',
  sourceUrl: 'https://otakudesu.cloud/anime/deep-modules',
  source: 'otakudesu',
  title: 'Deep Modules',
  description: 'A curated playlist covering the Deep Modules architecture.',
  posterUrl: null,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  episodes: [
    {
      id: 'dm-01',
      sourceUrl: 'https://otakudesu.cloud/dm-01',
      source: 'otakudesu',
      title: 'Intro to Deep Modules',
      videoSources: [
        {
          id: 'vs-1',
          type: 'direct',
          url: 'https://stream.com/dm-01.mp4',
          label: 'Server 1',
          quality: '1080p',
        },
        {
          id: 'vs-1b',
          type: 'direct',
          url: 'https://stream.com/dm-01-720p.mp4',
          label: 'Server 2',
          quality: '720p',
        },
        {
          id: 'vs-1c',
          type: 'embed',
          url: 'https://embed.com/dm-01',
          label: 'Embed Stream',
        },
      ],
      description: 'Learn the core concepts of Deep Modules architecture.',
      duration: '12:34',
      tags: ['Architecture', 'Core'],
      resolution: '4K',
      format: 'MP4',
      size: '450 MB',
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
    },
    {
      id: 'dm-02',
      sourceUrl: 'https://otakudesu.cloud/dm-02',
      source: 'otakudesu',
      title: 'TanStack Router Setup',
      videoSources: [
        {
          id: 'vs-2',
          type: 'direct',
          url: 'https://stream.com/dm-02.mp4',
          label: 'Server 1',
        },
      ],
      description: 'Step-by-step guide to file-based routing.',
      duration: '15:42',
      tags: ['Routing', 'React'],
      resolution: '1080p',
      format: 'MP4',
      size: '520 MB',
      createdAt: '2026-08-12',
      updatedAt: '2026-08-12',
    },
    {
      id: 'dm-03',
      sourceUrl: 'https://otakudesu.cloud/dm-03',
      source: 'otakudesu',
      title: 'Episode Without Video Stream',
      videoSources: [
        {
          id: 'vs-3',
          type: 'embed',
          url: 'https://desustream.net/dstream/arcg/?id=sample',
          label: 'Server 1',
        },
      ],
      description: 'Episode with missing videoUrl and fallback metadata genres.',
      duration: '10:00',
      tags: null,
      metadata: { genres: ['Action', 'Drama'] },
      resolution: '720p',
      format: 'MP4',
      size: '300 MB',
      createdAt: '2026-08-14',
      updatedAt: '2026-08-14',
    },
    {
      id: 'dm-04',
      sourceUrl: 'https://otakudesu.cloud/dm-04',
      source: 'otakudesu',
      title: 'Episode Without Any Stream',
      videoSources: [],
      description: 'Episode with no videoUrl and no embedUrl.',
      duration: '10:00',
      tags: null,
      resolution: '720p',
      format: 'MP4',
      size: '300 MB',
      createdAt: '2026-08-15',
      updatedAt: '2026-08-15',
    },
  ],
};

const firstEpisode = mockSeries.episodes[0];

describe('SeriesDetailView component', () => {
  beforeEach(() => {
    setAccessToken('test-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/deep-modules')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Series not found' } }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
  });

  it('renders series title and episode count', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    expect(await screen.findByRole('heading', { level: 1, name: mockSeries.title })).toBeInTheDocument();
    expect(
      screen.getAllByText(new RegExp(`${mockSeries.episodes.length}\\s+episodes`, 'i')).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(mockSeries.description!)).toBeInTheDocument();
  });

  it('renders a full-width data table of episodes for the active season', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    for (const episode of mockSeries.episodes) {
      expect(screen.getAllByText(episode.title).length).toBeGreaterThan(0);
    }
  });

  it('filters episode list based on search filter input', async () => {
    const { user } = renderWithProviders(
      <SeriesDetailView seriesId={mockSeries.id} />
    );

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const searchInput = screen.getByRole('textbox', { name: /search episodes/i });
    await user.type(searchInput, 'TanStack');

    expect(
      screen.getAllByText('TanStack Router Setup').length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Intro to Deep Modules')).not.toBeInTheDocument();
  });

  it('renders not found state for an unknown series', async () => {
    renderWithProviders(<SeriesDetailView seriesId="unknown-series" />);

    expect(await screen.findByText('Series not found')).toBeInTheDocument();
    expect(screen.getByText(/unknown-series/)).toBeInTheDocument();
  });

  it('opens custom Edit and Delete dialogs via row action menu', async () => {
    renderWithProviders(
      <>
        <SeriesDetailView seriesId={mockSeries.id} />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const user = userEvent.setup();

    // Open row actions menu for first episode
    const actionMenuButton = screen.getByRole('button', {
      name: `Actions for ${firstEpisode.title}`,
    });
    await user.click(actionMenuButton);

    // Test Edit Action opens Episode Detail Drawer
    const editButton = screen.getByRole('button', { name: /^edit$/i });
    await user.click(editButton);

    expect(await screen.findByRole('dialog', { name: `Episode Details: ${firstEpisode.title}` })).toBeInTheDocument();
    
    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;

    expect(titleInput.value).toBe(firstEpisode.title);
    expect(descInput.value).toBe(firstEpisode.description);

    // Close drawer
    const closeBtn = screen.getByRole('button', { name: /close drawer/i });
    await user.click(closeBtn);

    // Re-open action menu for Delete Dialog
    await user.click(actionMenuButton);
    const deleteButton = screen.getByRole('button', { name: /^delete$/i });
    await user.click(deleteButton);

    expect(await screen.findByRole('heading', { name: 'Delete Episode' })).toBeInTheDocument();
    expect(screen.getByText(`Are you sure you want to delete "${firstEpisode.title}"? This action cannot be undone.`)).toBeInTheDocument();

    const confirmDeleteButton = screen.getByRole('button', { name: /^delete$/i });
    await user.click(confirmDeleteButton);
  });

  it('renders Ready and No Stream badges in the episode table', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    expect(screen.getByText('No Stream')).toBeInTheDocument();
  });

  it('renders drag handles for episode reordering', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    for (const episode of mockSeries.episodes) {
      expect(screen.getByLabelText(`Reorder ${episode.title}`)).toBeInTheDocument();
    }
  });

  it('allows adding, updating, and removing video sources in manage sources dialog via row actions', async () => {
    let sourceUpdated = false;
    let sourceDeleted = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/episodes/dm-01/sources') && method === 'POST') {
        return new Response(
          JSON.stringify({
            data: {
              ...firstEpisode,
              videoSources: [
                ...firstEpisode.videoSources,
                { id: 'vs-new', type: 'direct', url: 'https://stream.com/new.mp4', label: 'New Server', quality: '1080p' }
              ]
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/episodes/dm-01/sources/vs-1') && method === 'PATCH') {
        sourceUpdated = true;
        return new Response(
          JSON.stringify({
            data: {
              ...firstEpisode,
              videoSources: firstEpisode.videoSources.map(s => s.id === 'vs-1' ? { ...s, label: 'Updated Server 1' } : s)
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/episodes/dm-01/sources/vs-1') && method === 'DELETE') {
        sourceDeleted = true;
        return new Response(
          JSON.stringify({
            data: {
              ...firstEpisode,
              videoSources: firstEpisode.videoSources.filter(s => s.id !== 'vs-1')
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/series/deep-modules')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <SeriesDetailView seriesId={mockSeries.id} />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    // Open row action menu for first episode
    const actionMenuButton = screen.getByRole('button', {
      name: `Actions for ${firstEpisode.title}`,
    });
    await user.click(actionMenuButton);

    // Open manage sources dialog
    const manageSourcesBtn = screen.getByRole('button', { name: /^sources$/i });
    await user.click(manageSourcesBtn);

    expect(await screen.findByRole('heading', { name: 'Manage Sources' })).toBeInTheDocument();

    // Verify tabs exist
    expect(screen.getByRole('tab', { name: 'Add from URL' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Edit Existing' })).toBeInTheDocument();

    // Test Add from URL tab scraping flow
    const scrapeUrlInput = screen.getByLabelText(/Otakudesu URL/i);
    const previewBtn = screen.getByRole('button', { name: /Preview/i });

    await user.type(scrapeUrlInput, 'https://otakudesu.cloud/episode/test-ep-1');
    await user.click(previewBtn);

    // Switch to "Edit Existing" tab
    const editExistingTab = screen.getByRole('tab', { name: 'Edit Existing' });
    await user.click(editExistingTab);

    // Verify existing video sources are displayed
    expect(screen.getByDisplayValue('Server 1')).toBeInTheDocument();

    // Update source
    const updateSourceBtn = screen.getAllByRole('button', { name: /Update Source|Save Source/i })[0];
    await user.click(updateSourceBtn);

    expect(sourceUpdated).toBe(true);

    // Remove source
    const removeSourceBtn = screen.getAllByRole('button', { name: /Remove Source|Delete Source/i })[0];
    await user.click(removeSourceBtn);

    expect(sourceDeleted).toBe(true);
  });

  it('renders Related Series section when relations exist', async () => {
    const mockSeriesWithRelations: SeriesDetails = {
      ...mockSeries,
      id: 'series-with-relations',
      relations: [
        { relatedSeriesId: 'dm-season-2', relationType: 'sequel', title: 'Deep Modules Season 2' },
        { relatedSeriesId: 'dm-prequel', relationType: 'prequel' },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/series-with-relations')) {
        return new Response(JSON.stringify({ data: mockSeriesWithRelations }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });

    renderWithProviders(<SeriesDetailView seriesId="series-with-relations" />);

    expect(await screen.findByText('Related Series')).toBeInTheDocument();
    expect(screen.getByText('sequel')).toBeInTheDocument();
    expect(screen.getByText('Deep Modules Season 2')).toBeInTheDocument();
    expect(screen.getByText('prequel')).toBeInTheDocument();
    expect(screen.getByText('dm-prequel')).toBeInTheDocument();

    const sequelLink = screen.getByText('Deep Modules Season 2').closest('a');
    expect(sequelLink).toBeInTheDocument();
    expect(sequelLink).toHaveAttribute('href', '/admin/videos/dm-season-2');
  });

  it('safely hides Related Series section when relations array is empty or undefined', async () => {
    const mockSeriesNoRelations: SeriesDetails = {
      ...mockSeries,
      id: 'series-no-relations',
      relations: [],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/series-no-relations')) {
        return new Response(JSON.stringify({ data: mockSeriesNoRelations }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });

    renderWithProviders(<SeriesDetailView seriesId="series-no-relations" />);

    await screen.findByRole('heading', { level: 1, name: mockSeriesNoRelations.title });
    expect(screen.queryByText('Related Series')).not.toBeInTheDocument();
  });

  it('renders season selector and filters episodes by selected season when multiple seasons exist', async () => {
    const mockSeriesWithSeasons: SeriesDetails = {
      id: 'multi-season-series',
      sourceUrl: 'https://otakudesu.cloud/anime/multi-season',
      source: 'otakudesu',
      title: 'Multi Season Anime',
      description: 'Series overview',
      posterUrl: null,
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
      seasons: [
        {
          id: 'season-1-id',
          seriesId: 'multi-season-series',
          sourceUrl: 'https://otakudesu.cloud/season-1',
          source: 'otakudesu',
          title: 'Season 1',
          description: 'Overview for Season 1',
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
            {
              id: 's1-ep2',
              seasonId: 'season-1-id',
              sourceUrl: 'https://otakudesu.cloud/s1-ep2',
              source: 'otakudesu',
              title: 'S1 Episode 2',
              order: 2,
              videoSources: [],
              createdAt: '2026-08-10',
              updatedAt: '2026-08-10',
            },
          ],
        },
        {
          id: 'season-2-id',
          seriesId: 'multi-season-series',
          sourceUrl: 'https://otakudesu.cloud/season-2',
          source: 'otakudesu',
          title: 'Season 2',
          description: 'Overview for Season 2',
          posterUrl: null,
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: [
            {
              id: 's2-ep1',
              seasonId: 'season-2-id',
              sourceUrl: 'https://otakudesu.cloud/s2-ep1',
              source: 'otakudesu',
              title: 'S2 Episode 1',
              order: 1,
              videoSources: [],
              createdAt: '2026-08-10',
              updatedAt: '2026-08-10',
            },
          ],
        },
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
        {
          id: 's1-ep2',
          seasonId: 'season-1-id',
          sourceUrl: 'https://otakudesu.cloud/s1-ep2',
          source: 'otakudesu',
          title: 'S1 Episode 2',
          order: 2,
          videoSources: [],
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
        },
        {
          id: 's2-ep1',
          seasonId: 'season-2-id',
          sourceUrl: 'https://otakudesu.cloud/s2-ep1',
          source: 'otakudesu',
          title: 'S2 Episode 1',
          order: 1,
          videoSources: [],
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/multi-season-series')) {
        return new Response(JSON.stringify({ data: mockSeriesWithSeasons }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });

    const user = userEvent.setup();
    renderWithProviders(<SeriesDetailView seriesId="multi-season-series" />);

    await screen.findByRole('heading', { level: 1, name: 'Multi Season Anime' });

    // Verify season tabs/buttons exist
    expect(screen.getByRole('button', { name: 'Season 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Season 2' })).toBeInTheDocument();

    // Default season (Season 1) episodes should be visible
    expect(screen.getAllByText('S1 Episode 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S1 Episode 2').length).toBeGreaterThan(0);
    expect(screen.queryByText('S2 Episode 1')).not.toBeInTheDocument();

    // Click Season 2 button
    await user.click(screen.getByRole('button', { name: 'Season 2' }));

    // Season 2 episodes should now be visible, Season 1 hidden
    expect(screen.getAllByText('S2 Episode 1').length).toBeGreaterThan(0);
    expect(screen.queryByText('S1 Episode 1')).not.toBeInTheDocument();
    expect(screen.queryByText('S1 Episode 2')).not.toBeInTheDocument();
  });

  it('dynamically swaps season poster and description when switching seasons', async () => {
    const mockSeriesWithSeasonMetadata: SeriesDetails = {
      id: 'season-meta-series',
      sourceUrl: 'https://otakudesu.cloud/anime/season-meta',
      source: 'otakudesu',
      title: 'Season Meta Anime',
      description: 'Series default description',
      posterUrl: 'https://image.tmdb.org/t/p/w500/series-poster.jpg',
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
      seasons: [
        {
          id: 'season-1-meta',
          seriesId: 'season-meta-series',
          sourceUrl: 'https://otakudesu.cloud/season-1',
          source: 'otakudesu',
          title: 'Season 1',
          description: 'Season 1 specific description',
          posterUrl: 'https://image.tmdb.org/t/p/w500/season1-poster.jpg',
          tmdbSeason: 1,
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: [],
        },
        {
          id: 'season-2-meta',
          seriesId: 'season-meta-series',
          sourceUrl: 'https://otakudesu.cloud/season-2',
          source: 'otakudesu',
          title: 'Season 2',
          description: 'Season 2 specific description',
          posterUrl: 'https://image.tmdb.org/t/p/w500/season2-poster.jpg',
          tmdbSeason: 2,
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: [],
        },
      ],
      episodes: [],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/season-meta-series')) {
        return new Response(JSON.stringify({ data: mockSeriesWithSeasonMetadata }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });

    const user = userEvent.setup();
    renderWithProviders(<SeriesDetailView seriesId="season-meta-series" />);

    await screen.findByRole('heading', { level: 1, name: 'Season Meta Anime' });

    // Initially Season 1 description & poster are shown
    expect(screen.getByText('Season 1 specific description')).toBeInTheDocument();
    const posterImg = screen.getByAltText('Season Meta Anime') as HTMLImageElement;
    expect(posterImg.src).toBe('https://image.tmdb.org/t/p/w500/season1-poster.jpg');

    // Click Season 2 button
    await user.click(screen.getByRole('button', { name: 'Season 2' }));

    // Season 2 description & poster should now be active
    expect(screen.getByText('Season 2 specific description')).toBeInTheDocument();
    expect(screen.queryByText('Season 1 specific description')).not.toBeInTheDocument();
    expect((screen.getByAltText('Season Meta Anime') as HTMLImageElement).src).toBe(
      'https://image.tmdb.org/t/p/w500/season2-poster.jpg'
    );
  });

  it('gracefully hides season selector tabs when series has 1 or no distinct seasons', async () => {
    const mockSingleSeasonSeries: SeriesDetails = {
      id: 'single-season-series',
      sourceUrl: 'https://otakudesu.cloud/anime/single-season',
      source: 'otakudesu',
      title: 'Single Season Movie',
      description: 'Movie overview',
      posterUrl: null,
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
      seasons: [
        {
          id: 'single-season-id',
          seriesId: 'single-season-series',
          sourceUrl: 'https://otakudesu.cloud/single-season',
          source: 'otakudesu',
          title: 'Season 1',
          description: 'Single Season',
          posterUrl: null,
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: [
            {
              id: 'm1-ep1',
              seasonId: 'single-season-id',
              sourceUrl: 'https://otakudesu.cloud/m1-ep1',
              source: 'otakudesu',
              title: 'Movie Main Stream',
              order: 1,
              videoSources: [],
              createdAt: '2026-08-10',
              updatedAt: '2026-08-10',
            },
          ],
        },
      ],
      episodes: [
        {
          id: 'm1-ep1',
          seasonId: 'single-season-id',
          sourceUrl: 'https://otakudesu.cloud/m1-ep1',
          source: 'otakudesu',
          title: 'Movie Main Stream',
          order: 1,
          videoSources: [],
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/single-season-series')) {
        return new Response(JSON.stringify({ data: mockSingleSeasonSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });

    renderWithProviders(<SeriesDetailView seriesId="single-season-series" />);

    await screen.findByRole('heading', { level: 1, name: 'Single Season Movie' });

    // Season tab for "Season 1" should NOT be rendered since seasons <= 1
    expect(screen.queryByRole('button', { name: 'Season 1' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Movie Main Stream').length).toBeGreaterThan(0);
  });

  it('does not render "Merge Seasons" or "Add Season" buttons when multiple seasons exist', async () => {
    const mockMultiSeasonSeries: SeriesDetails = {
      id: 'merge-seasons-series',
      sourceUrl: 'https://otakudesu.cloud/anime/merge-seasons',
      source: 'otakudesu',
      title: 'Attack on Titan',
      description: 'Multi part season anime',
      posterUrl: null,
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
      seasons: [
        {
          id: 'season-part-1',
          seriesId: 'merge-seasons-series',
          sourceUrl: 'https://otakudesu.cloud/aot-part-1',
          source: 'otakudesu',
          title: 'Season 4 Part 1',
          description: 'Part 1',
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: [],
        },
        {
          id: 'season-part-2',
          seriesId: 'merge-seasons-series',
          sourceUrl: 'https://otakudesu.cloud/aot-part-2',
          source: 'otakudesu',
          title: 'Season 4 Part 2',
          description: 'Part 2',
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: [],
        },
      ],
      episodes: [],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/merge-seasons-series')) {
        return new Response(JSON.stringify({ data: mockMultiSeasonSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });

    renderWithProviders(<SeriesDetailView seriesId="merge-seasons-series" />);

    await screen.findByRole('heading', { level: 1, name: 'Attack on Titan' });

    expect(screen.queryByRole('button', { name: /Merge Seasons/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Season/i })).not.toBeInTheDocument();
  });

  it('does not render "Sync Episodes" button in season toolbar', async () => {
    const mockSyncSeries: SeriesDetails = {
      id: 'sync-episodes-series',
      sourceUrl: 'https://otakudesu.cloud/anime/sync-series',
      source: 'otakudesu',
      title: 'Frieren',
      description: 'Fantasy anime',
      posterUrl: null,
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
      seasons: [
        {
          id: 'season-sync-1',
          seriesId: 'sync-episodes-series',
          sourceUrl: 'https://otakudesu.cloud/frieren-s1',
          source: 'otakudesu',
          title: 'Season 1',
          description: 'Season 1 desc',
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: [],
        },
      ],
      episodes: [],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/sync-episodes-series')) {
        return new Response(JSON.stringify({ data: mockSyncSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });

    renderWithProviders(<SeriesDetailView seriesId="sync-episodes-series" />);

    await screen.findByRole('heading', { level: 1, name: 'Frieren' });

    expect(screen.queryByRole('button', { name: /Sync Episodes/i })).not.toBeInTheDocument();
  });

  it('renders "Bulk Add Sources" button and opens BulkScrapeModal on click', async () => {
    const mockBulkSeries: SeriesDetails = {
      id: 'bulk-scrape-series',
      sourceUrl: 'https://otakudesu.cloud/anime/bulk-series',
      source: 'otakudesu',
      title: 'Solo Leveling',
      description: 'Action anime',
      posterUrl: null,
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
      episodes: [],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/bulk-scrape-series')) {
        return new Response(JSON.stringify({ data: mockBulkSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });

    const user = userEvent.setup();
    renderWithProviders(<SeriesDetailView seriesId="bulk-scrape-series" />);

    await screen.findByRole('heading', { level: 1, name: 'Solo Leveling' });

    const bulkBtn = screen.getByRole('button', { name: /Bulk Add Sources/i });
    expect(bulkBtn).toBeInTheDocument();

    await user.click(bulkBtn);

    expect(await screen.findByRole('heading', { name: 'Bulk Add Sources' })).toBeInTheDocument();
  });

  it('renders Edit Series button and updates featured field via PATCH', async () => {
    let patchedBody: Record<string, unknown> | null = null;
    const mockOngoingSeries: SeriesDetails = {
      ...mockSeries,
      id: 'edit-series-test',
      isFeatured: false,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/genres')) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/series/edit-series-test') && method === 'PATCH') {
        patchedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            data: {
              ...mockOngoingSeries,
              ...patchedBody,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/series/edit-series-test')) {
        return new Response(JSON.stringify({ data: mockOngoingSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/series')) {
        return new Response(
          JSON.stringify({
            data: { series: [mockOngoingSeries], meta: { total: 1, page: 1, limit: 20 } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });

    const { user } = renderWithProviders(<SeriesDetailView seriesId="edit-series-test" />);

    await screen.findByRole('heading', { level: 1, name: mockOngoingSeries.title });

    const editSeriesBtn = screen.getByRole('button', { name: /Edit Series/i });
    await user.click(editSeriesBtn);

    expect(await screen.findByRole('heading', { name: 'Edit Series' })).toBeInTheDocument();

    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();

    const featuredCheckbox = screen.getByLabelText('Featured Series') as HTMLInputElement;
    expect(featuredCheckbox).toBeInTheDocument();
    expect(featuredCheckbox.checked).toBe(false);

    await user.click(featuredCheckbox);
    expect(featuredCheckbox.checked).toBe(true);

    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    await user.click(saveBtn);

    expect(patchedBody).toEqual(
      expect.objectContaining({
        isFeatured: true,
      })
    );
  });

  it('does not render "Match TMDB" or "+ Add Episode" buttons in header, and preserves other header actions', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    expect(screen.queryByRole('button', { name: /Match TMDB/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Episode/i })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Edit Series/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bulk Add Sources/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bulk Ingest URLs/i })).toBeInTheDocument();
  });

  it('renders 3-dot contextual menu for active season actions when multiple seasons exist', async () => {
    const mockSeasonSeries: SeriesDetails = {
      ...mockSeries,
      seasons: [
        {
          id: 'dm-season-1',
          seriesId: 'deep-modules',
          sourceUrl: 'https://otakudesu.cloud/anime/deep-modules',
          source: 'otakudesu',
          title: 'Season 1',
          description: 'First season',
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: [],
        },
        {
          id: 'dm-season-2',
          seriesId: 'deep-modules',
          sourceUrl: 'https://otakudesu.cloud/anime/deep-modules-s2',
          source: 'otakudesu',
          title: 'Season 2',
          description: 'Second season',
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: [],
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/deep-modules')) {
        return new Response(JSON.stringify({ data: mockSeasonSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Series not found' } }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    const { user } = renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const menuBtn = screen.getByRole('button', { name: /season actions/i });
    expect(menuBtn).toBeInTheDocument();

    await user.click(menuBtn);

    expect(screen.getByRole('button', { name: /Edit Season/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy Season ID/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Season/i })).toBeInTheDocument();
  });

  it('handles batch cross-season move execution via confirmation dialog', async () => {
    const mockSeasonSeries: SeriesDetails = {
      ...mockSeries,
      seasons: [
        {
          id: 'dm-season-1',
          seriesId: 'deep-modules',
          sourceUrl: 'https://otakudesu.cloud/anime/deep-modules',
          source: 'otakudesu',
          title: 'Season 1',
          description: 'First season',
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: mockSeries.episodes.map((e) => ({
            ...e,
            seasonId: 'dm-season-1',
          })),
        },
        {
          id: 'dm-season-2',
          seriesId: 'deep-modules',
          sourceUrl: 'https://otakudesu.cloud/anime/deep-modules-s2',
          source: 'otakudesu',
          title: 'Season 2',
          description: 'Second season',
          createdAt: '2026-08-10',
          updatedAt: '2026-08-10',
          episodes: [],
        },
      ],
      episodes: mockSeries.episodes.map((e) => ({
        ...e,
        seasonId: 'dm-season-1',
      })),
    };

    let reorderCalled = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/deep-modules/episodes/order') && init?.method === 'PATCH') {
        reorderCalled = true;
        return new Response(JSON.stringify({ data: { success: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/series/deep-modules')) {
        return new Response(JSON.stringify({ data: mockSeasonSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Series not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const { user } = renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);
    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    // Select row 1
    const checkbox1 = screen.getByLabelText('Select Intro to Deep Modules');
    await user.click(checkbox1);

    // Open Batch Move Modal
    const moveBtn = screen.getByRole('button', { name: /move to season/i });
    await user.click(moveBtn);

    expect(screen.getByRole('heading', { name: /move episodes to season/i })).toBeInTheDocument();

    // Confirm Move
    const confirmMoveBtn = screen.getByRole('button', { name: /^move episodes$/i });
    await user.click(confirmMoveBtn);

    expect(reorderCalled).toBe(true);
  });

  it('handles batch delete execution via confirmation dialog', async () => {
    let deletedCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/episodes/') && init?.method === 'DELETE') {
        deletedCount++;
        return new Response(JSON.stringify({ data: { id: 'deleted' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/series/deep-modules')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Series not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const { user } = renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);
    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    // Select all visible episodes via header checkbox
    const headerCheckbox = screen.getByLabelText('Select all visible episodes');
    await user.click(headerCheckbox);

    // Click delete selected in toolbar
    const deleteBatchBtn = screen.getByRole('button', { name: /delete selected/i });
    await user.click(deleteBatchBtn);

    expect(screen.getByRole('heading', { name: /delete selected episodes/i })).toBeInTheDocument();

    // Confirm Delete
    const confirmDeleteBtn = screen.getByRole('button', { name: /delete 4 episodes/i });
    await user.click(confirmDeleteBtn);

    expect(deletedCount).toBe(4);
  });

  it('opens slide-out drawer on episode row click or edit click and closes via close button', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/deep-modules')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Series not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const { user } = renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);
    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    // Drawer is closed initially
    expect(screen.queryByRole('dialog', { name: /Episode Details:/i })).not.toBeInTheDocument();

    // Click episode row
    const epRow = screen.getByText('Intro to Deep Modules');
    await user.click(epRow);

    // Drawer is now open
    expect(screen.getByRole('dialog', { name: 'Episode Details: Intro to Deep Modules' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Intro to Deep Modules')).toBeInTheDocument();

    // Close drawer via close button
    const closeBtn = screen.getByRole('button', { name: /close drawer/i });
    await user.click(closeBtn);

    expect(screen.queryByRole('dialog', { name: /Episode Details:/i })).not.toBeInTheDocument();
  });

  it('automatically opens drawer on initial render when initialOrder or initialEpisodeId is provided', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/deep-modules')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Series not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    });

    renderWithProviders(
      <SeriesDetailView seriesId={mockSeries.id} initialEpisodeId="dm-01" />
    );

    // Drawer automatically opens for dm-01
    expect(await screen.findByRole('dialog', { name: 'Episode Details: Intro to Deep Modules' })).toBeInTheDocument();
  });
});
