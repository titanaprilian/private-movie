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
      videoUrl: 'https://stream.com/dm-01.mp4',
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
      videoUrl: 'https://stream.com/dm-02.mp4',
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
      videoUrl: '',
      embedUrl: 'https://desustream.net/dstream/arcg/?id=sample',
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
      videoUrl: null,
      embedUrl: null,
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
  return screen.getByRole('heading', { name: firstEpisode.title });
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
      screen.getByRole('heading', { name: secondEpisode.title })
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
    const urlInput = screen.getByLabelText('Video URL') as HTMLInputElement;

    expect(titleInput.value).toBe(firstEpisode.title);
    expect(descInput.value).toBe(firstEpisode.description);
    expect(urlInput.value).toBe(firstEpisode.videoUrl);

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

  it('renders "Resolve Stream" button when videoUrl is null/empty and embedUrl is present', async () => {
    const { user } = renderWithProviders(<SeriesDetailView seriesId={mockSeries.id} />);

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    // Default episode (dm-01) has videoUrl, so "Resolve Stream" button should not be present
    expect(screen.queryByRole('button', { name: /resolve stream/i })).not.toBeInTheDocument();

    // Click episode dm-03 which has embedUrl but no videoUrl
    const episodeWithEmbed = screen.getAllByText('Episode Without Video Stream')[0];
    await user.click(episodeWithEmbed);

    expect(screen.getByRole('button', { name: /resolve stream/i })).toBeInTheDocument();

    // Click episode dm-04 which has no embedUrl and no videoUrl
    const episodeNoEmbed = screen.getAllByText('Episode Without Any Stream')[0];
    await user.click(episodeNoEmbed);

    expect(screen.queryByRole('button', { name: /resolve stream/i })).not.toBeInTheDocument();
  });

  it('triggers resolve mutation with loading state and refreshes data on success', async () => {
    let resolved = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('/episodes/dm-03/resolve')) {
        resolved = true;
        return new Response(
          JSON.stringify({
            data: {
              ...mockSeries.episodes[2],
              videoUrl: 'https://stream.com/dm-03-resolved.mp4',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/series/deep-modules')) {
        const episodes = resolved
          ? mockSeries.episodes.map((ep) =>
              ep.id === 'dm-03'
                ? { ...ep, videoUrl: 'https://stream.com/dm-03-resolved.mp4' }
                : ep
            )
          : mockSeries.episodes;
        return new Response(JSON.stringify({ data: { ...mockSeries, episodes } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const { user } = renderWithProviders(
      <>
        <SeriesDetailView seriesId={mockSeries.id} />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const episodeWithEmbed = screen.getAllByText('Episode Without Video Stream')[0];
    await user.click(episodeWithEmbed);

    const resolveBtn = screen.getByRole('button', { name: /resolve stream/i });
    expect(resolveBtn).toBeInTheDocument();

    await user.click(resolveBtn);

    // Assert that loading state or success happens and custom video player is mounted
    expect(await screen.findByTestId('custom-video-element')).toBeInTheDocument();
  });

  it('displays error toast when stream resolution fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('/episodes/dm-03/resolve')) {
        return new Response(
          JSON.stringify({
            error: { code: 'STREAM_NOT_FOUND', message: 'No video stream found' },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/series/deep-modules')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const { user } = renderWithProviders(
      <>
        <SeriesDetailView seriesId={mockSeries.id} />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: mockSeries.title });

    const episodeWithEmbed = screen.getAllByText('Episode Without Video Stream')[0];
    await user.click(episodeWithEmbed);

    const resolveBtn = screen.getByRole('button', { name: /resolve stream/i });
    await user.click(resolveBtn);

    expect(await screen.findByText(/Failed to resolve stream/i)).toBeInTheDocument();
  });
});
