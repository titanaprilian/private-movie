import { renderWithProviders, screen } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditSeasonDialog } from '@/modules/videos/internal/EditSeasonDialog';
import type { SeasonDetails } from '@/modules/videos/internal/api';
import * as apiModule from '@/modules/videos/internal/api';
import { Toaster } from '@/components/ui/sonner';

describe('EditSeasonDialog Component', () => {
  const mockSeason: SeasonDetails = {
    id: 'season-123',
    seriesId: 'series-456',
    title: 'Season 1',
    description: 'Initial description',
    status: 'ongoing',
    scraperUrl: 'https://otakudesu.cloud/anime/my-hero',
    source: 'otakudesu',
    episodeOffset: 12,
    lastScrapedAt: '2026-09-14T02:30:00.000Z',
    lastScrapeError: 'Connection timeout error from provider',
    createdAt: '2026-08-10',
    updatedAt: '2026-08-10',
    episodes: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders existing season scraper configuration and tracking information', () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <>
        <EditSeasonDialog
          open={true}
          onOpenChange={onOpenChange}
          season={mockSeason}
        />
        <Toaster />
      </>
    );

    expect(screen.getByLabelText('Title')).toHaveValue('Season 1');
    expect(screen.getByLabelText('Description')).toHaveValue('Initial description');
    expect(screen.getByLabelText('Scraper URL')).toHaveValue('https://otakudesu.cloud/anime/my-hero');
    expect(screen.getByLabelText('Episode Offset')).toHaveValue(12);
    expect(screen.getByText(/Last Scraped:/i)).toBeInTheDocument();
    expect(screen.getByText(/Connection timeout error from provider/i)).toBeInTheDocument();
  });

  it('auto-detects provider source from scraper URL when modified', async () => {
    const onOpenChange = vi.fn();
    const updateSeasonSpy = vi.spyOn(apiModule, 'updateSeason').mockResolvedValue({
      ...mockSeason,
      scraperUrl: 'https://dramula.com/watch/drama-show',
      source: 'dramula',
      episodeOffset: 5,
    });

    const { user } = renderWithProviders(
      <>
        <EditSeasonDialog
          open={true}
          onOpenChange={onOpenChange}
          season={{
            ...mockSeason,
            scraperUrl: null,
            source: null,
            episodeOffset: 0,
            lastScrapedAt: null,
            lastScrapeError: null,
          }}
        />
        <Toaster />
      </>
    );

    const scraperUrlInput = screen.getByLabelText('Scraper URL');
    const episodeOffsetInput = screen.getByLabelText('Episode Offset');

    await user.type(scraperUrlInput, 'https://dramula.com/watch/drama-show');
    await user.clear(episodeOffsetInput);
    await user.type(episodeOffsetInput, '5');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    expect(updateSeasonSpy).toHaveBeenCalledWith('season-123', {
      title: 'Season 1',
      description: 'Initial description',
      status: 'ongoing',
      scraperUrl: 'https://dramula.com/watch/drama-show',
      source: 'dramula',
      episodeOffset: 5,
    });
  });

  it('submits updated values and closes dialog on success', async () => {
    const onOpenChange = vi.fn();
    const updateSeasonSpy = vi.spyOn(apiModule, 'updateSeason').mockResolvedValue(mockSeason);

    const { user } = renderWithProviders(
      <>
        <EditSeasonDialog
          open={true}
          onOpenChange={onOpenChange}
          season={mockSeason}
        />
        <Toaster />
      </>
    );

    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Season 1 Updated');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    expect(updateSeasonSpy).toHaveBeenCalledWith('season-123', expect.objectContaining({
      title: 'Season 1 Updated',
      scraperUrl: 'https://otakudesu.cloud/anime/my-hero',
      source: 'otakudesu',
      episodeOffset: 12,
    }));
  });
});
