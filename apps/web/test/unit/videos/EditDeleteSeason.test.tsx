import { renderWithProviders, screen } from '../../utils';
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
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => {
    const href = params ? to.replace('$seriesId', params.seriesId) : to;
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

const season1 = {
  id: 'season-1-id',
  seriesId: 'edit-season-series',
  sourceUrl: 'https://otakudesu.cloud/season-1',
  source: 'otakudesu',
  title: 'Season 1',
  description: null,
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
  ],
};

const season2 = {
  id: 'season-2-id',
  seriesId: 'edit-season-series',
  sourceUrl: 'https://otakudesu.cloud/season-2',
  source: 'otakudesu',
  title: 'Season 2',
  description: null,
  posterUrl: null,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  episodes: [],
};

const mockSeries: SeriesDetails = {
  id: 'edit-season-series',
  sourceUrl: 'https://otakudesu.cloud/anime/edit-season',
  source: 'otakudesu',
  title: 'Edit Season Anime',
  description: 'Series overview',
  posterUrl: null,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  seasons: [season1, season2],
  episodes: season1.episodes,
};

function setupFetch(options?: {
  onDeleteError?: Response;
}) {
  let patchPayload: unknown = null;
  let patchCalled = false;
  let deleteCalled = false;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = init?.method?.toUpperCase() ?? 'GET';

    if (url.includes('/seasons/season-1-id') && method === 'PATCH') {
      patchCalled = true;
      patchPayload = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ data: { ...season1, title: 'Renamed Season' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/seasons/season-1-id') && method === 'DELETE') {
      deleteCalled = true;
      if (options?.onDeleteError) {
        return options.onDeleteError;
      }
      return new Response(JSON.stringify({ data: { deleted: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/series/edit-season-series')) {
      return new Response(JSON.stringify({ data: mockSeries }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }),
      { status: 404 }
    );
  });

  return {
    isPatchCalled: () => patchCalled,
    getPatchPayload: () => patchPayload,
    isDeleteCalled: () => deleteCalled,
  };
}

describe('Edit & delete season flow in SeriesDetailView', () => {
  beforeEach(() => {
    setAccessToken('test-token');
  });

  it('edits the active season title/description/status via PATCH /seasons/:id', async () => {
    const fetchSpy = setupFetch();

    const { user } = renderWithProviders(
      <>
        <SeriesDetailView seriesId="edit-season-series" />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Edit Season Anime' });

    await user.click(screen.getByRole('button', { name: /season actions/i }));
    await user.click(screen.getByRole('button', { name: /edit season/i }));

    expect(
      await screen.findByRole('heading', { name: 'Edit Season' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Season 1');

    const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
    expect(statusSelect).toBeInTheDocument();
    expect(statusSelect.value).toBe('completed');
    await user.selectOptions(statusSelect, 'ongoing');

    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Renamed Season');
    await user.type(screen.getByLabelText('Description'), 'Custom context');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(fetchSpy.isPatchCalled()).toBe(true);
    expect(fetchSpy.getPatchPayload()).toEqual({
      title: 'Renamed Season',
      description: 'Custom context',
      status: 'ongoing',
    });

    expect(await screen.findByText('Season updated successfully')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Edit Season' })
    ).not.toBeInTheDocument();
  });

  it('copies active season ID to clipboard from 3-dot dropdown menu', async () => {
    setupFetch();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    const { user } = renderWithProviders(
      <>
        <SeriesDetailView seriesId="edit-season-series" />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Edit Season Anime' });

    await user.click(screen.getByRole('button', { name: /season actions/i }));
    await user.click(screen.getByRole('button', { name: /copy season id/i }));

    expect(writeTextSpy).toHaveBeenCalledWith('season-1-id');
    expect(await screen.findByText('Season ID copied to clipboard')).toBeInTheDocument();
  });

  it('deletes an empty season via DELETE /seasons/:id', async () => {
    const fetchSpy = setupFetch();

    const { user } = renderWithProviders(
      <>
        <SeriesDetailView seriesId="edit-season-series" />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Edit Season Anime' });

    await user.click(screen.getByRole('button', { name: /season actions/i }));
    await user.click(screen.getByRole('button', { name: /delete season/i }));

    expect(
      await screen.findByRole('heading', { name: 'Delete Season' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(fetchSpy.isDeleteCalled()).toBe(true);
    expect(await screen.findByText('Season deleted successfully')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Delete Season' })
    ).not.toBeInTheDocument();
  });

  it('shows a toast error when deletion is blocked by the strict policy', async () => {
    const fetchSpy = setupFetch({
      onDeleteError: new Response(
        JSON.stringify({
          error: {
            code: 'SEASON_NOT_EMPTY',
            message: 'Season still contains 1 episode(s) and cannot be deleted',
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      ),
    });

    const { user } = renderWithProviders(
      <>
        <SeriesDetailView seriesId="edit-season-series" />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Edit Season Anime' });

    await user.click(screen.getByRole('button', { name: /season actions/i }));
    await user.click(screen.getByRole('button', { name: /delete season/i }));
    await screen.findByRole('heading', { name: 'Delete Season' });
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(fetchSpy.isDeleteCalled()).toBe(true);
    expect(await screen.findByText('Cannot delete season')).toBeInTheDocument();
    expect(
      await screen.findByText('Season still contains 1 episode(s) and cannot be deleted')
    ).toBeInTheDocument();
    // The season menu trigger is still available
    expect(screen.getByRole('button', { name: /season actions/i })).toBeInTheDocument();
  });

  it('allows editing season metadata on a single-season series and disables season deletion', async () => {
    let patchPayload: unknown = null;
    const singleSeason = {
      id: 'single-season-1',
      seriesId: 'single-season-series-id',
      sourceUrl: 'https://otakudesu.cloud/single-1',
      source: 'otakudesu',
      title: 'Season 1',
      status: 'completed',
      description: 'Single season description',
      posterUrl: null,
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
      episodes: [],
    };

    const singleSeasonSeries: SeriesDetails = {
      id: 'single-season-series-id',
      sourceUrl: 'https://otakudesu.cloud/single',
      source: 'otakudesu',
      title: 'Single Season Title',
      description: 'Single series description',
      posterUrl: null,
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
      seasons: [singleSeason],
      episodes: [],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/seasons/single-season-1') && method === 'PATCH') {
        patchPayload = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            data: { ...singleSeason, status: 'ongoing', title: 'Season 1 Updated' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/series/single-season-series-id')) {
        return new Response(JSON.stringify({ data: singleSeasonSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }),
        { status: 404 }
      );
    });

    const { user } = renderWithProviders(
      <>
        <SeriesDetailView seriesId="single-season-series-id" />
        <Toaster />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Single Season Title' });

    // Verify season bar is rendered
    expect(screen.getByRole('button', { name: 'Season 1' })).toBeInTheDocument();
    expect(screen.getByTestId('season-status-badge')).toHaveTextContent('completed');

    // Open season actions menu
    await user.click(screen.getByRole('button', { name: /season actions/i }));

    // Verify Delete Season is disabled
    const deleteBtn = screen.getByRole('button', { name: /delete season/i });
    expect(deleteBtn).toBeDisabled();

    // Open Edit Season
    await user.click(screen.getByRole('button', { name: /edit season/i }));
    expect(await screen.findByRole('heading', { name: 'Edit Season' })).toBeInTheDocument();

    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Season 1 Updated');

    const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
    await user.selectOptions(statusSelect, 'ongoing');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(patchPayload).toEqual({
      title: 'Season 1 Updated',
      description: 'Single season description',
      status: 'ongoing',
    });

    expect((await screen.findAllByText('Season updated successfully')).length).toBeGreaterThan(0);
  });
});
