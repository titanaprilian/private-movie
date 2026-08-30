import { renderWithProviders, screen, waitFor } from '../../utils';
import { cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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

vi.mock('@/modules/videos/internal/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/videos/internal/api')>();
  return {
    ...actual,
    previewBulkSources: vi.fn(),
    scrapeEpisodeSources: vi.fn(),
  };
});

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
    { id: 'ep-1', title: 'Intro to Deep Modules', order: 1, seasonId: 's1', seasonNumber: 1, seasonTitle: 'Season 1', hasSources: false },
    { id: 'ep-2', title: 'TanStack Router Setup', order: 2, seasonId: 's1', seasonNumber: 1, seasonTitle: 'Season 1', hasSources: false },
    { id: 'ep-3', title: 'State Management', order: 3, seasonId: 's1', seasonNumber: 1, seasonTitle: 'Season 1', hasSources: false },
  ],
};

describe('BulkScrapeModal component', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.previewBulkSources).mockResolvedValue(mockPreviewResult);
    vi.mocked(api.scrapeEpisodeSources).mockResolvedValue({
      id: 'ep-1',
      title: 'Scraped Ep',
      videoSources: [],
      createdAt: '',
      updatedAt: '',
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

  it('renders Step 1 form when open including Dramula source option', async () => {
    const { user } = renderWithProviders(
      <BulkScrapeModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
      />
    );

    expect(screen.getByText('Bulk Add Sources')).toBeInTheDocument();
    expect(screen.getByLabelText(/Season \/ Scraper URL/i)).toBeInTheDocument();
    const sourceTypeSelect = screen.getByLabelText(/Source Type/i);
    expect(sourceTypeSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dramula' })).toBeInTheDocument();

    await user.selectOptions(sourceTypeSelect, 'dramula');
    expect(sourceTypeSelect).toHaveValue('dramula');

    expect(screen.getByLabelText(/Target Season/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Episode Offset/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview/i })).toBeInTheDocument();
  });

  it('automatically calculates episode offset when Target Season selection changes', async () => {
    const multiSeasons = [
      {
        id: 's1',
        title: 'Season 1',
        tmdbSeason: 1,
        episodes: [{ id: 'ep-1', title: 'Ep 1', order: 1 }],
      },
      {
        id: 's2',
        title: 'Season 2',
        tmdbSeason: 2,
        episodes: [{ id: 'ep-13', title: 'Ep 13', order: 13 }],
      },
    ];

    const { user } = renderWithProviders(
      <BulkScrapeModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        seasons={multiSeasons}
      />
    );

    const targetSeasonSelect = screen.getByLabelText(/Target Season/i);
    const offsetInput = screen.getByLabelText(/Episode Offset/i);

    // Default first season is Season 1, offset is 0
    expect(targetSeasonSelect).toHaveValue('s1');
    expect(offsetInput).toHaveValue(0);

    // Select Season 2 (first ep order 13) -> offset should update to 12
    await user.selectOptions(targetSeasonSelect, 's2');
    expect(targetSeasonSelect).toHaveValue('s2');
    expect(offsetInput).toHaveValue(12);

    // User can manually edit Episode Offset after auto-calculation
    await user.clear(offsetInput);
    await user.type(offsetInput, '15');
    expect(offsetInput).toHaveValue(15);
  });

  it('renders dynamic helper text below Target Season dropdown explaining math', async () => {
    const partialSeasons = [
      {
        id: 's1',
        title: 'Season 1',
        tmdbSeason: 1,
        episodes: [
          { id: 'ep-1', title: 'Ep 1', order: 1, hasSources: true },
          { id: 'ep-2', title: 'Ep 2', order: 2, hasSources: true },
          { id: 'ep-3', title: 'Ep 3', order: 3, hasSources: false },
          { id: 'ep-4', title: 'Ep 4', order: 4, hasSources: false },
        ],
      },
    ];

    renderWithProviders(
      <BulkScrapeModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        seasons={partialSeasons}
      />
    );

    expect(
      screen.getByText('2/4 episodes already have sources. Auto-offsetting to start from Episode 3.')
    ).toBeInTheDocument();
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
    vi.mocked(api.previewBulkSources).mockRejectedValueOnce(new Error('Network connection failed'));

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

    // Ep 7.5 combobox
    const ep75Trigger = screen.getByLabelText('Target episode for Episode 7.5 (Recap OVA)');
    expect(ep75Trigger).toHaveTextContent('-- Skip / Unmapped --');

    // Select ep-3 for Ep 7.5
    await user.click(ep75Trigger);
    const ep3Options = await screen.findAllByText(/Ep 3: State Management/i);
    await user.click(ep3Options[ep3Options.length - 1]);

    expect(ep75Trigger).toHaveTextContent('Ep 3: State Management');

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
        'Bulk sources processed',
        expect.objectContaining({
          description: expect.stringContaining('Successfully scraped'),
        })
      );
    });

    // Close button should be present once processing is done
    const footerCloseBtn = await screen.findByTestId('bulk-scrape-close-btn');
    await user.click(footerCloseBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders overwrite warning badge and intercepts Save with confirmation dialog when overwrite conflicts exist', async () => {
    const mockPreviewResultWithConflict = {
      ...mockPreviewResult,
      localEpisodes: [
        { id: 'ep-1', title: 'Intro to Deep Modules', order: 1, seasonId: 's1', seasonNumber: 1, seasonTitle: 'Season 1', hasSources: true },
        { id: 'ep-2', title: 'TanStack Router Setup', order: 2, seasonId: 's1', seasonNumber: 1, seasonTitle: 'Season 1', hasSources: false },
        { id: 'ep-3', title: 'State Management', order: 3, seasonId: 's1', seasonNumber: 1, seasonTitle: 'Season 1', hasSources: false },
      ],
    };
    vi.mocked(api.previewBulkSources).mockResolvedValueOnce(mockPreviewResultWithConflict);

    const { user } = renderWithProviders(
      <BulkScrapeModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockPreviewResultWithConflict.localEpisodes}
        seasons={[
          {
            id: 's1',
            title: 'Season 1',
            tmdbSeason: 1,
            episodes: mockPreviewResultWithConflict.localEpisodes,
          },
        ]}
      />
    );

    const urlInput = screen.getByLabelText(/Season \/ Scraper URL/i);
    await user.type(urlInput, 'https://otakudesu.cloud/anime/otaku-anime');
    await user.click(screen.getByRole('button', { name: /Preview/i }));

    await waitFor(() => {
      expect(screen.getByText('⚠️ Overwrites existing sources')).toBeInTheDocument();
    });

    // Click Save -> Intercept modal should open
    await user.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(screen.getByText('Overwrite Existing Sources?')).toBeInTheDocument();
    });

    // Click Cancel -> stays on Step 2
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Overwrite Existing Sources?')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();

    // Click Save again -> Intercept modal opens, click Confirm & Save -> proceeds to Step 3
    await user.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(screen.getByText('Overwrite Existing Sources?')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Confirm & Save' }));

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Bulk sources processed',
        expect.objectContaining({
          description: expect.stringContaining('Successfully scraped'),
        })
      );
    });
  });
});
