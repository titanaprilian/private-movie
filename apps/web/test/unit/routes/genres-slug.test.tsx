import { renderWithProviders, screen, waitFor, within } from '../../utils';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act } from '@testing-library/react';
import { routeTree } from '@/routeTree.gen';
import { setAccessToken } from '@/lib/api';

function makeSeries(id: string, overrides: Record<string, unknown> = {}) {
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

function installFetchMock(handleSeries: (req: CapturedSeriesRequest) => unknown) {
  const requests: CapturedSeriesRequest[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
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
      return new Response(JSON.stringify(handleSeries(captured)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: null }), { status: 200 });
  });
  return { requests };
}

function buildRouter(initialEntry: string | string[]) {
  const initialEntries = Array.isArray(initialEntry) ? initialEntry : [initialEntry];
  const history = createMemoryHistory({ initialEntries });
  return createRouter({ routeTree, history });
}

describe('Genre catalog route (/genres/$slug)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock-access-token');
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the dedicated catalog instead of CinematicHome, with genre header, tabs, and series grid', async () => {
    installFetchMock(() => makePage([makeSeries('s-1', { title: 'Queen of Tears' })], 1, 20, 1));
    const router = buildRouter('/genres/korean-drama');

    renderWithProviders(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Korean Drama' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All Series' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Ongoing' })).toHaveAttribute('aria-selected', 'false');
    expect(await screen.findByText('Queen of Tears')).toBeInTheDocument();

    // No homepage hero slider, carousels, or recently added episodes section.
    expect(screen.queryByText('Recently Added')).not.toBeInTheDocument();
    expect(screen.queryByText('Top Rated')).not.toBeInTheDocument();
    expect(screen.queryByText(/recently added episodes/i)).not.toBeInTheDocument();
  });

  it('syncs the Ongoing tab to search params and refetches with filter=ongoing', async () => {
    const { requests } = installFetchMock((req) =>
      req.filter === 'ongoing'
        ? makePage([makeSeries('s-ongoing', { title: 'Ongoing Hit' })], 1, 20, 1)
        : makePage([makeSeries('s-1', { title: 'Catalog Hit' })], 1, 20, 1)
    );
    const router = buildRouter('/genres/korean-drama');
    const { user } = renderWithProviders(<RouterProvider router={router} />);

    await screen.findByText('Catalog Hit');
    await user.click(screen.getByRole('tab', { name: 'Ongoing' }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ filter: 'ongoing' });
    });
    expect(screen.getByRole('tab', { name: 'Ongoing' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Ongoing Hit')).toBeInTheDocument();
    expect(requests.some((r) => r.filter === 'ongoing' && r.genre === 'korean-drama')).toBe(true);
  });

  it('restores the Ongoing filter from a shareable URL on direct navigation', async () => {
    installFetchMock(() => makePage([makeSeries('s-ongoing', { title: 'Ongoing Hit' })], 1, 20, 1));
    const router = buildRouter('/genres/korean-drama?filter=ongoing');

    renderWithProviders(<RouterProvider router={router} />);

    expect(await screen.findByText('Ongoing Hit')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ongoing' })).toHaveAttribute('aria-selected', 'true');
  });

  it('links series cards to the watch page', async () => {
    installFetchMock(() => makePage([makeSeries('s-1', { title: 'Queen of Tears' })], 1, 20, 1));
    const router = buildRouter('/genres/korean-drama');

    renderWithProviders(<RouterProvider router={router} />);

    const card = await screen.findByTestId('series-card');
    expect(card).toHaveAttribute('href', '/watch/s-1');
    expect(within(card as HTMLElement).getByText('Queen of Tears')).toBeInTheDocument();
  });

  it('shows an empty state with a Show All Series action that resets the filter', async () => {
    installFetchMock((req) =>
      req.filter === 'ongoing'
        ? makePage([], 1, 20, 0)
        : makePage([makeSeries('s-1', { title: 'Catalog Hit' })], 1, 20, 1)
    );
    const router = buildRouter('/genres/korean-drama?filter=ongoing');
    const { user } = renderWithProviders(<RouterProvider router={router} />);

    expect(await screen.findByText(/no ongoing series found/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show All Series' }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ filter: 'all' });
    });
    expect(await screen.findByText('Catalog Hit')).toBeInTheDocument();
  });

  it('keeps browser history entries when switching filters', async () => {
    installFetchMock(() => makePage([makeSeries('s-1', { title: 'Catalog Hit' })], 1, 20, 1));
    const router = buildRouter(['/', '/genres/korean-drama']);
    const { user } = renderWithProviders(<RouterProvider router={router} />);
    await screen.findByText('Catalog Hit');

    // Filter switches use replace navigation so back returns to the previous page, not a filter step.
    await user.click(screen.getByRole('tab', { name: 'Ongoing' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ filter: 'ongoing' });
    });

    await act(async () => {
      router.history.back();
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });
});
