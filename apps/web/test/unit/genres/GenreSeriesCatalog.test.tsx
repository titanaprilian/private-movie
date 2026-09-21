import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor, within } from '../../utils';
import { setAccessToken } from '@/lib/api';
import {
  GenreSeriesCatalog,
  type GenreSeriesCatalogProps,
} from '@/modules/genres';

type SeriesFixtureOverrides = Record<string, unknown>;

function makeSeries(id: string, overrides: SeriesFixtureOverrides = {}) {
  return {
    id,
    sourceUrl: 'https://example.com/source',
    source: 'otakudesu',
    title: `Series ${id}`,
    type: 'tv',
    description: `Description for ${id}`,
    posterUrl: `https://example.com/poster-${id}.jpg`,
    rating: '8.5',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePage(items: unknown[], page: number, limit: number, total: number) {
  return { data: { series: items, meta: { total, page, limit } } };
}

const genresPayload = {
  data: [{ id: 'g-1', name: 'Korean Drama', slug: 'korean-drama' }],
};

interface CapturedSeriesRequest {
  genre: string | null;
  filter: string | null;
  page: string | null;
  limit: string | null;
}

function installFetchMock(
  handleSeries: (req: CapturedSeriesRequest) => unknown,
  opts: { seriesStatus?: number } = {}
) {
  const requests: CapturedSeriesRequest[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes('/api/genres')) {
      return new Response(JSON.stringify(genresPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/api/series')) {
      const parsed = new URL(url, 'http://localhost');
      const captured: CapturedSeriesRequest = {
        genre: parsed.searchParams.get('genre'),
        filter: parsed.searchParams.get('filter'),
        page: parsed.searchParams.get('page'),
        limit: parsed.searchParams.get('limit'),
      };
      requests.push(captured);
      const status = opts.seriesStatus ?? 200;
      return new Response(JSON.stringify(handleSeries(captured)), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: null }), { status: 200 });
  });
  return { spy, requests };
}

let intersectionCallback: IntersectionObserverCallback | null = null;

function installIntersectionObserverMock() {
  intersectionCallback = null;
  const observe = vi.fn();
  const disconnect = vi.fn();
  const unobserve = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
        this.callback = callback;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = unobserve;
    }
  );
  return { observe, disconnect, unobserve };
}

function triggerSentinelVisible() {
  act(() => {
    intersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  });
}

function renderCatalog(props: GenreSeriesCatalogProps) {
  const rootRoute = createRootRoute();
  const watchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/watch/$seriesId',
    component: () => <div>watch page</div>,
  });
  const genreRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/genres/$slug',
    component: () => <GenreSeriesCatalog {...props} />,
  });
  const routeTree = rootRoute.addChildren([watchRoute, genreRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/genres/${props.slug}`] }),
  });
  return { ...renderWithProviders(<RouterProvider router={router} />), router };
}

describe('GenreSeriesCatalog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock-access-token');
    installIntersectionObserverMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the human-readable genre name and filter tabs with All Series selected by default', async () => {
    installFetchMock(() => makePage([makeSeries('s-1')], 1, 20, 1));
    const onFilterChange = vi.fn();

    renderCatalog({ slug: 'korean-drama', filter: 'all', onFilterChange });

    expect(await screen.findByRole('heading', { level: 1, name: 'Korean Drama' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All Series' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Ongoing' })).toHaveAttribute('aria-selected', 'false');
    expect(await screen.findByText('Series s-1')).toBeInTheDocument();
  });

  it('falls back to a formatted slug when the genre is not in the genres list', async () => {
    installFetchMock(() => makePage([makeSeries('s-1')], 1, 20, 1));

    renderCatalog({ slug: 'unknown-genre', filter: 'all', onFilterChange: vi.fn() });

    expect(await screen.findByRole('heading', { level: 1, name: 'Unknown Genre' })).toBeInTheDocument();
  });

  it('does not render hero, carousel rows, or recently added episodes sections', async () => {
    installFetchMock(() => makePage([makeSeries('s-1')], 1, 20, 1));

    renderCatalog({ slug: 'korean-drama', filter: 'all', onFilterChange: vi.fn() });

    await screen.findByText('Series s-1');
    expect(screen.queryByText('Recently Added')).not.toBeInTheDocument();
    expect(screen.queryByText('Top Rated')).not.toBeInTheDocument();
    expect(screen.queryByText(/recently added episodes/i)).not.toBeInTheDocument();
  });

  it('notifies the parent when the Ongoing tab is clicked and queries with filter=ongoing', async () => {
    const { requests } = installFetchMock((req) => {
      if (req.filter === 'ongoing') {
        return makePage([makeSeries('s-ongoing')], 1, 20, 1);
      }
      return makePage([makeSeries('s-1')], 1, 20, 1);
    });
    const onFilterChange = vi.fn();
    const { user } = renderCatalog({ slug: 'korean-drama', filter: 'all', onFilterChange });

    await screen.findByText('Series s-1');
    await user.click(screen.getByRole('tab', { name: 'Ongoing' }));

    expect(onFilterChange).toHaveBeenCalledWith('ongoing');
    expect(requests[0]).toMatchObject({ genre: 'korean-drama', page: '1', limit: '20' });
  });

  it('fetches the next page when the sentinel scrolls into view and appends cards', async () => {
    const pageOne = Array.from({ length: 20 }, (_, i) => makeSeries(`s-p1-${i}`));
    const pageTwo = Array.from({ length: 5 }, (_, i) => makeSeries(`s-p2-${i}`));
    installFetchMock((req) =>
      req.page === '2' ? makePage(pageTwo, 2, 20, 25) : makePage(pageOne, 1, 20, 25)
    );

    renderCatalog({ slug: 'korean-drama', filter: 'all', onFilterChange: vi.fn() });

    await waitFor(() => {
      expect(screen.getAllByTestId('series-card')).toHaveLength(20);
    });

    triggerSentinelVisible();

    await waitFor(() => {
      expect(screen.getAllByTestId('series-card')).toHaveLength(25);
    });
    expect(screen.getByText('Series s-p2-0')).toBeInTheDocument();
  });

  it('renders poster, title, media type tag, rating, and links cards to the watch page', async () => {
    installFetchMock(() =>
      makePage(
        [
          makeSeries('s-tv', { title: 'Drama Hit', type: 'tv', rating: '9.1' }),
          makeSeries('s-movie', {
            title: 'Film Hit',
            type: 'movie',
            rating: '7.4',
            posterUrl: 'https://example.com/film.jpg',
          }),
        ],
        1,
        20,
        2
      )
    );

    renderCatalog({ slug: 'korean-drama', filter: 'all', onFilterChange: vi.fn() });

    const cards = await screen.findAllByTestId('series-card');
    expect(cards).toHaveLength(2);

    const tvCard = within(cards[0] as HTMLElement);
    expect(tvCard.getByText('Drama Hit')).toBeInTheDocument();
    expect(tvCard.getByText('TV')).toBeInTheDocument();
    expect(tvCard.getByText('9.1')).toBeInTheDocument();
    expect(tvCard.getByAltText('Drama Hit')).toHaveAttribute(
      'src',
      'https://example.com/poster-s-tv.jpg'
    );
    expect(cards[0]).toHaveAttribute('href', '/watch/s-tv');

    const movieCard = within(cards[1] as HTMLElement);
    expect(movieCard.getByText('Movie')).toBeInTheDocument();
    expect(movieCard.getByText('7.4')).toBeInTheDocument();
    expect(cards[1]).toHaveAttribute('href', '/watch/s-movie');
  });

  it('shows skeleton cards while the initial page loads', async () => {
    let resolveFetch!: (value: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/genres')) {
        return new Response(JSON.stringify(genresPayload), { status: 200 });
      }
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    });

    renderCatalog({ slug: 'korean-drama', filter: 'all', onFilterChange: vi.fn() });

    expect(await screen.findAllByTestId('series-card-skeleton')).not.toHaveLength(0);

    await act(async () => {
      resolveFetch(
        new Response(JSON.stringify(makePage([makeSeries('s-1')], 1, 20, 1)), { status: 200 })
      );
    });

    expect(await screen.findByText('Series s-1')).toBeInTheDocument();
  });

  it('shows a Retry button when the initial fetch fails', async () => {
    let shouldFail = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/genres')) {
        return new Response(JSON.stringify(genresPayload), { status: 200 });
      }
      if (url.includes('/api/series')) {
        if (shouldFail) {
          return new Response(
            JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }),
            { status: 500 }
          );
        }
        return new Response(JSON.stringify(makePage([makeSeries('s-retry')], 1, 20, 1)), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });
    const { user } = renderCatalog({ slug: 'korean-drama', filter: 'all', onFilterChange: vi.fn() });

    const retryButton = await screen.findByRole('button', { name: 'Retry' });
    shouldFail = false;

    await user.click(retryButton);
    expect(await screen.findByText('Series s-retry')).toBeInTheDocument();
  });

  it('keeps loaded cards and shows an inline Retry when an incremental page fails', async () => {
    const pageOne = Array.from({ length: 20 }, (_, i) => makeSeries(`s-p1-${i}`));
    const pageTwo = Array.from({ length: 5 }, (_, i) => makeSeries(`s-p2-${i}`));
    let failPageTwo = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/genres')) {
        return new Response(JSON.stringify(genresPayload), { status: 200 });
      }
      if (url.includes('/api/series')) {
        const parsed = new URL(url, 'http://localhost');
        if (parsed.searchParams.get('page') === '2') {
          if (failPageTwo) {
            return new Response(
              JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }),
              { status: 500 }
            );
          }
          return new Response(JSON.stringify(makePage(pageTwo, 2, 20, 25)), { status: 200 });
        }
        return new Response(JSON.stringify(makePage(pageOne, 1, 20, 25)), { status: 200 });
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });
    const { user } = renderCatalog({ slug: 'korean-drama', filter: 'all', onFilterChange: vi.fn() });

    await waitFor(() => {
      expect(screen.getAllByTestId('series-card')).toHaveLength(20);
    });

    triggerSentinelVisible();

    const retryButton = await screen.findByRole('button', { name: 'Retry' });
    // Loaded content stays on screen instead of being replaced by the full error state.
    expect(screen.getAllByTestId('series-card')).toHaveLength(20);

    failPageTwo = false;
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getAllByTestId('series-card')).toHaveLength(25);
    });
    expect(screen.getByText('Series s-p2-0')).toBeInTheDocument();
  });

  it('renders an empty state with a Show All Series action when nothing matches the ongoing filter', async () => {
    installFetchMock(() => makePage([], 1, 20, 0));
    const onFilterChange = vi.fn();
    const { user } = renderCatalog({ slug: 'korean-drama', filter: 'ongoing', onFilterChange });

    expect(await screen.findByText(/no ongoing series found/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show All Series' }));
    expect(onFilterChange).toHaveBeenCalledWith('all');
  });
});
