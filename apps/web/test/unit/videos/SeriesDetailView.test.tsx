import { renderWithProviders, screen, userEvent } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesDetailView } from '@/modules/videos/internal/SeriesDetailView';
import type { SeriesDetails } from '@/modules/videos/internal/api';
import { Toaster } from '@/components/ui/sonner';
import { setAccessToken } from '@/lib/api';

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

function firstEpisodeHeading() {
  return screen.getByRole('heading', { level: 2, name: firstEpisode.title });
}

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
      screen.getByText(`${mockSeries.episodes.length} episodes`)
    ).toBeInTheDocument();
    expect(screen.getByText(mockSeries.description!)).toBeInTheDocument();
  });

  it('renders a scrollable list of episodes in the left pane', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    for (const episode of mockSeries.episodes) {
      expect(screen.getAllByText(episode.title).length).toBeGreaterThan(0);
    }
  });

  it('renders details pane on the right for the default selected episode', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    expect(firstEpisodeHeading()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('updates the selected episode details when an item in the left pane is clicked', async () => {
    const { user } = renderWithProviders(
      <SeriesDetailView seriesId={mockSeries.id} />
    );

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const secondEpisode = mockSeries.episodes[1];
    const secondItem = screen.getAllByText(secondEpisode.title)[0];
    await user.click(secondItem);

    expect(
      screen.getByRole('heading', { level: 2, name: secondEpisode.title })
    ).toBeInTheDocument();
    expect(screen.getByText(secondEpisode.description!)).toBeInTheDocument();
  });

  it('filters episode list based on filter input', async () => {
    const { user } = renderWithProviders(
      <SeriesDetailView seriesId={mockSeries.id} />
    );

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const searchInput = screen.getByPlaceholderText(/filter episodes/i);
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

  it('opens custom Edit and Delete dialogs when edit and delete buttons are clicked', async () => {
    renderWithProviders(
      <>
        <SeriesDetailView seriesId={mockSeries.id} />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const user = userEvent.setup();

    const addButton = screen.getByRole('button', { name: /add episode/i });
    await user.click(addButton);
    expect(await screen.findByText('Add Media Wizard')).toBeInTheDocument();

    // Test Edit Dialog
    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);

    expect(await screen.findByRole('heading', { name: 'Edit Episode' })).toBeInTheDocument();
    
    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;

    expect(titleInput.value).toBe(firstEpisode.title);
    expect(descInput.value).toBe(firstEpisode.description);

    // Save changes
    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    await user.click(saveButton);

    // Test Delete Dialog
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(await screen.findByRole('heading', { name: 'Delete Episode' })).toBeInTheDocument();
    expect(screen.getByText(`Are you sure you want to delete "${firstEpisode.title}"? This action cannot be undone.`)).toBeInTheDocument();

    const confirmDeleteButton = screen.getByRole('button', { name: /^delete$/i });
    await user.click(confirmDeleteButton);
  });

  it('renders custom video player with videoUrl when available and displays Ready badge', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.src).toBe('https://stream.com/dm-01.mp4');
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders fallback UI and No Stream badge when videoUrl is missing', async () => {
    const { user } = renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const noStreamEpisode = screen.getAllByText('Episode Without Any Stream')[0];
    await user.click(noStreamEpisode);

    expect(screen.queryByTitle('Episode Without Any Stream')).not.toBeInTheDocument();
    expect(screen.getByText('No Stream Available')).toBeInTheDocument();
    expect(screen.getByText('No Stream')).toBeInTheDocument();
  });

  it('extracts and renders metadata.genres when tags is null or empty', async () => {
    const { user } = renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const noStreamEpisode = screen.getAllByText('Episode Without Video Stream')[0];
    await user.click(noStreamEpisode);

    expect(screen.getAllByText('Action').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Drama').length).toBeGreaterThan(0);
  });

  it('renders drag handles for episode reordering', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    for (const episode of mockSeries.episodes) {
      expect(screen.getByLabelText(`Reorder ${episode.title}`)).toBeInTheDocument();
    }
  });

  it('renders source selector button group with Direct and Embed sections', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    expect(screen.getByText('Direct')).toBeInTheDocument();
    expect(screen.getByText('Embed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Server 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Server 2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Embed Stream/i })).toBeInTheDocument();
  });

  it('auto-plays the first source when an episode is selected', async () => {
    renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.src).toBe(firstEpisode.videoSources[0].url);
  });

  it('clicking a source button switches the active video source', async () => {
    const { user } = renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    // Initially playing first source (direct - Server 1)
    let video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video.src).toBe('https://stream.com/dm-01.mp4');

    // Click Server 2 (direct 720p)
    const server2Btn = screen.getByRole('button', { name: /Server 2/i });
    await user.click(server2Btn);

    video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video.src).toBe('https://stream.com/dm-01-720p.mp4');

    // Click Embed Stream button
    const embedBtn = screen.getByRole('button', { name: /Embed Stream/i });
    await user.click(embedBtn);

    const iframe = screen.getByTitle(firstEpisode.title) as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toBe('https://embed.com/dm-01');
  });

  it('allows adding, updating, and removing video sources in manage sources dialog', async () => {
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
});
