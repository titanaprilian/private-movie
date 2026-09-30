import { renderWithProviders, screen } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddSeasonDialog } from '@/modules/videos/internal/AddSeasonDialog';
import { getNextSeasonNumber, getSeasonNumber } from '@/modules/videos/internal/seasonUtils';
import type { SeasonDetails } from '@/modules/videos/internal/api';
import * as apiModule from '@/modules/videos/internal/api';
import { Toaster } from '@/components/ui/sonner';

function makeSeason(overrides: Partial<SeasonDetails> = {}): SeasonDetails {
  return {
    id: 'season-1',
    seriesId: 'series-1',
    title: 'Season 1',
    description: null,
    status: 'completed',
    scraperUrl: null,
    source: null,
    episodeOffset: 0,
    createdAt: '2026-08-10',
    updatedAt: '2026-08-10',
    episodes: [],
    ...overrides,
  } as SeasonDetails;
}

describe('seasonUtils', () => {
  it('returns 1 when there are no seasons', () => {
    expect(getNextSeasonNumber([])).toBe(1);
  });

  it('computes next number from highest seasonNumber', () => {
    const seasons = [
      makeSeason({ id: 'a', seasonNumber: 1 } as Partial<SeasonDetails>),
      makeSeason({ id: 'b', seasonNumber: 3 } as Partial<SeasonDetails>),
    ];
    expect(getNextSeasonNumber(seasons)).toBe(4);
  });

  it('falls back to tmdbSeason and index', () => {
    const seasons = [makeSeason({ id: 'a', tmdbSeason: 2 })];
    expect(getSeasonNumber(seasons[0], 0)).toBe(2);
    expect(getSeasonNumber(makeSeason({ id: 'b' }), 4)).toBe(5);
  });
});

describe('AddSeasonDialog Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('pre-fills season number and title from highest existing season', () => {
    renderWithProviders(
      <>
        <AddSeasonDialog
          open={true}
          onOpenChange={() => {}}
          seriesId="series-1"
          seasons={[
            makeSeason({ id: 'a', seasonNumber: 1 } as Partial<SeasonDetails>),
            makeSeason({ id: 'b', seasonNumber: 2 } as Partial<SeasonDetails>),
          ]}
        />
        <Toaster />
      </>
    );

    expect(screen.getByLabelText('Season Number')).toHaveValue(3);
    expect(screen.getByLabelText('Title')).toHaveValue('Season 3');
  });

  it('renders with accessible dialog attributes and Chunky components', () => {
    renderWithProviders(
      <AddSeasonDialog open={true} onOpenChange={() => {}} seriesId="series-1" seasons={[]} />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Season Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Scraper URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Episode Offset')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create season/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('dispatches createSeason mutation and closes on success', async () => {
    const onOpenChange = vi.fn();
    const createSpy = vi.spyOn(apiModule, 'createSeason').mockResolvedValue(
      makeSeason({ id: 'new', title: 'Season 2' })
    );

    const { user } = renderWithProviders(
      <>
        <AddSeasonDialog
          open={true}
          onOpenChange={onOpenChange}
          seriesId="series-1"
          seasons={[makeSeason({ id: 'a', seasonNumber: 1 } as Partial<SeasonDetails>)]}
        />
        <Toaster />
      </>
    );

    const submit = screen.getByRole('button', { name: /create season/i });
    await user.click(submit);

    expect(createSpy).toHaveBeenCalledWith(
      'series-1',
      expect.objectContaining({
        title: 'Season 2',
        seasonNumber: 2,
        status: 'completed',
      })
    );
  });

  it('does not submit when title is empty', async () => {
    const createSpy = vi.spyOn(apiModule, 'createSeason').mockResolvedValue(
      makeSeason({ id: 'new' })
    );

    const { user } = renderWithProviders(
      <AddSeasonDialog open={true} onOpenChange={() => {}} seriesId="series-1" seasons={[]} />
    );

    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    expect(screen.getByRole('button', { name: /create season/i })).toBeDisabled();
    expect(createSpy).not.toHaveBeenCalled();
  });
});
