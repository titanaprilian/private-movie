import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ManageSourcesDialog } from '@/modules/videos/internal/ManageSourcesDialog';
import * as apiModule from '@/modules/videos/internal/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/modules/videos/internal/api', async () => {
  const actual = await vi.importActual<typeof import('@/modules/videos/internal/api')>(
    '@/modules/videos/internal/api'
  );
  return {
    ...actual,
    previewScrape: vi.fn(),
    addVideoSources: vi.fn(),
    updateVideoSource: vi.fn(),
    deleteVideoSource: vi.fn(),
  };
});

const mockEpisode: apiModule.Episode = {
  id: 'ep-123',
  sourceUrl: 'https://otakudesu.cloud/ep1',
  source: 'otakudesu',
  title: 'Episode 1',
  videoSources: [
    {
      id: 'src-1',
      type: 'direct',
      url: 'https://stream.com/video1.mp4',
      label: 'Server 1',
      quality: '1080p',
    },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('ManageSourcesDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed or episode is null', () => {
    const { container } = renderWithProviders(
      <ManageSourcesDialog open={false} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('previews scrape result and saves sources successfully', async () => {
    const mockPreviewResult: apiModule.PreviewScrapeResult = {
      episode: {
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Episode 1',
        videoType: 'mp4',
        videoSources: [
          {
            type: 'direct',
            url: 'https://stream.com/scraped.mp4',
            label: 'Scraped Server 1',
            quality: '720p',
          },
          {
            type: 'embed',
            url: 'https://embed.com/scraped',
            label: 'Scraped Embed',
          },
        ],
        metadata: {},
      },
      series: null,
      warnings: [],
    };

    vi.mocked(apiModule.previewScrape).mockResolvedValueOnce(mockPreviewResult);
    vi.mocked(apiModule.addVideoSources).mockResolvedValueOnce(mockEpisode);

    const onOpenChange = vi.fn();
    const { user, queryClient } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={onOpenChange} episode={mockEpisode} seriesId="series-1" />
    );

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Input URL
    const urlInput = screen.getByPlaceholderText(/https:\/\/otakudesu\.cloud\/episode/i);
    await user.type(urlInput, 'https://otakudesu.cloud/ep1');

    // Click Preview
    const previewBtn = screen.getByRole('button', { name: /^Preview$/i });
    await user.click(previewBtn);

    // Verify previewScrape called
    expect(apiModule.previewScrape).toHaveBeenCalledWith({
      sourceUrl: 'https://otakudesu.cloud/ep1',
      source: 'otakudesu',
    });

    // Verify preview extracted sources displayed
    expect(await screen.findByText('Extracted Sources (2)')).toBeInTheDocument();
    expect(screen.getByText('Scraped Server 1')).toBeInTheDocument();
    expect(screen.getByText('Scraped Embed')).toBeInTheDocument();

    // Click Save Sources
    const saveBtn = screen.getByRole('button', { name: /Save Sources/i });
    await user.click(saveBtn);

    // Verify addVideoSources API called
    await waitFor(() => {
      expect(apiModule.addVideoSources).toHaveBeenCalledWith(
        'ep-123',
        mockPreviewResult.episode.videoSources
      );
    });

    // Verify cache invalidation, toast notification, and tab switch
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-1'] });
      expect(toast.success).toHaveBeenCalledWith('video.source_add', {
        description: 'Successfully saved video sources',
      });
      // Extracted state cleared and active tab switched to edit-existing (where existing source is shown)
      expect(screen.getByDisplayValue('Server 1')).toBeInTheDocument();
    });
  });
});
