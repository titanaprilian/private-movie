import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BulkScrapeModal } from '@/modules/videos/internal/BulkScrapeModal';
import * as api from '@/modules/videos/internal/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockLocalEpisodes = [
  { id: 'ep-1', title: 'Intro to Deep Modules', order: 1 },
  { id: 'ep-2', title: 'TanStack Router Setup', order: 2 },
  { id: 'ep-3', title: 'State Management', order: 3 },
];

const mockSeasons = [
  {
    id: 's1',
    title: 'Season 1',
    tmdbSeason: 1,
    episodes: mockLocalEpisodes,
  },
];

const mockPreviewResult = {
  scrapedEpisodes: [
    {
      scrapedTitle: 'Episode 1',
      scrapedUrl: 'https://otakudesu.cloud/anime/ep1',
      episodeNumber: 1,
      calculatedOrder: 1,
      matchedLocalEpisodeId: 'ep-1',
      matchStatus: 'matched' as const,
    },
    {
      scrapedTitle: 'Episode 2',
      scrapedUrl: 'https://otakudesu.cloud/anime/ep2',
      episodeNumber: 2,
      calculatedOrder: 2,
      matchedLocalEpisodeId: 'ep-2',
      matchStatus: 'matched' as const,
    },
    {
      scrapedTitle: 'Episode 7.5 (Recap OVA)',
      scrapedUrl: 'https://otakudesu.cloud/anime/ep7.5',
      episodeNumber: 7.5,
      calculatedOrder: null,
      matchedLocalEpisodeId: null,
      matchStatus: 'unmatched' as const,
    },
    {
      scrapedTitle: 'Episode 3',
      scrapedUrl: 'https://otakudesu.cloud/anime/ep3',
      episodeNumber: 3,
      calculatedOrder: 3,
      matchedLocalEpisodeId: 'ep-3',
      matchStatus: 'matched' as const,
    },
  ],
  localEpisodes: [
    { id: 'ep-1', title: 'Intro to Deep Modules', order: 1, seasonId: 's1', seasonNumber: 1, seasonTitle: 'Season 1' },
    { id: 'ep-2', title: 'TanStack Router Setup', order: 2, seasonId: 's1', seasonNumber: 1, seasonTitle: 'Season 1' },
    { id: 'ep-3', title: 'State Management', order: 3, seasonId: 's1', seasonNumber: 1, seasonTitle: 'Season 1' },
  ],
};

describe('BulkScrapeModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'previewBulkSources').mockResolvedValue(mockPreviewResult);
    vi.spyOn(api, 'saveBulkSources').mockResolvedValue({
      success: true,
      savedCount: 3,
      skippedCount: 1,
    });
  });

  it('renders nothing when open is false', () => {
    const { container } = renderWithProviders(
      <BulkScrapeModal
        open={false}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Step 1 form when open', () => {
    renderWithProviders(
      <BulkScrapeModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
      />
    );

    expect(screen.getByText('Bulk Add Sources')).toBeInTheDocument();
    expect(screen.getByLabelText(/Season \/ Scraper URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Source Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Episode Offset/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview/i })).toBeInTheDocument();
  });

  it('transitions to Step 2 upon submitting valid URL', async () => {
    const { user } = renderWithProviders(
      <BulkScrapeModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    const urlInput = screen.getByLabelText(/Season \/ Scraper URL/i);
    await user.type(urlInput, 'https://otakudesu.cloud/anime/otaku-anime');

    const previewBtn = screen.getByRole('button', { name: /Preview/i });
    await user.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText('Episode 7.5 (Recap OVA)')).toBeInTheDocument();
    });

    expect(screen.getByText('Needs Review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
  });

  it('shows error toast if preview fetch fails', async () => {
    vi.spyOn(api, 'previewBulkSources').mockRejectedValueOnce(new Error('Network connection failed'));

    const { user } = renderWithProviders(
      <BulkScrapeModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
      />
    );

    const urlInput = screen.getByLabelText(/Season \/ Scraper URL/i);
    await user.type(urlInput, 'https://otakudesu.cloud/anime/otaku-anime');
    await user.click(screen.getByRole('button', { name: /Preview/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Bulk Scrape Preview Error',
        expect.objectContaining({
          description: 'Network connection failed',
        })
      );
    });
  });

  it('allows changing target episode mapping and toggling ignore status in Step 2', async () => {
    const { user } = renderWithProviders(
      <BulkScrapeModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    const urlInput = screen.getByLabelText(/Season \/ Scraper URL/i);
    await user.type(urlInput, 'https://otakudesu.cloud/anime/otaku-anime');
    await user.click(screen.getByRole('button', { name: /Preview/i }));

    await waitFor(() => {
      expect(screen.getByText('Episode 7.5 (Recap OVA)')).toBeInTheDocument();
    });

    // Ep 7.5 dropdown
    const ep75Select = screen.getByLabelText('Target episode for Episode 7.5 (Recap OVA)');
    expect(ep75Select).toHaveValue('');

    // Select ep-3 for Ep 7.5
    await user.selectOptions(ep75Select, 'ep-3');
    expect(ep75Select).toHaveValue('ep-3');

    // Toggle ignore for Ep 1
    const ignoreEp1Btn = screen.getByLabelText('Ignore Episode 1');
    await user.click(ignoreEp1Btn);

    expect(screen.getByText('Ignored')).toBeInTheDocument();
  });

  it('returns to Step 1 when Back is clicked', async () => {
    const { user } = renderWithProviders(
      <BulkScrapeModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
      />
    );

    const urlInput = screen.getByLabelText(/Season \/ Scraper URL/i);
    await user.type(urlInput, 'https://otakudesu.cloud/anime/otaku-anime');
    await user.click(screen.getByRole('button', { name: /Preview/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Back/i }));

    expect(screen.getByRole('button', { name: /Preview/i })).toBeInTheDocument();
  });

  it('transitions to Step 3 processing view when Save is clicked, displays progress and log, and closes via Close button', async () => {
    const onOpenChange = vi.fn();

    const { user } = renderWithProviders(
      <BulkScrapeModal
        open={true}
        onOpenChange={onOpenChange}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
      />
    );

    const urlInput = screen.getByLabelText(/Season \/ Scraper URL/i);
    await user.type(urlInput, 'https://otakudesu.cloud/anime/otaku-anime');
    await user.click(screen.getByRole('button', { name: /Preview/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Save/i }));

    // Should be in Step 3
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Processing Log')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Bulk sources saved',
        expect.objectContaining({
          description: expect.stringContaining('Successfully processed'),
        })
      );
    });

    // Close button should be present once processing is done
    const closeBtns = await screen.findAllByRole('button', { name: /Close/i });
    // The main dialog footer Close button
    const footerCloseBtn = closeBtns.find((btn) => btn.getAttribute('class')?.includes('bg-primary')) || closeBtns[0];
    await user.click(footerCloseBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
