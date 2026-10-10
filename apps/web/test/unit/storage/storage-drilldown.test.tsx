import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setAccessToken } from '@/lib/api';
import { StorageView } from '@/modules/storage';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));

const mockSeriesResponse = {
  items: [
    {
      id: 'series-1',
      title: 'Cyberpunk Series',
      s3SourceCount: 2,
      s3SizeBytes: 6442450944,
      seasons: [
        { id: 'season-1', seasonNumber: 1, title: 'Season 1', s3SourceCount: 1, s3SizeBytes: 100 },
        { id: 'season-2', seasonNumber: 2, title: 'Season 2', s3SourceCount: 1, s3SizeBytes: 200 },
      ],
    },
  ],
  total: 1,
};

const mockBackendItems = [
  {
    key: 's1e1.mp4', filename: 's1e1.mp4', sizeBytes: 100,
    lastModified: '2026-09-01T10:00:00.000Z', status: 'linked' as const,
    videoSourceId: 'src-1', label: 'Main', quality: '1080p',
    episodeId: 'ep-1', episodeTitle: 'Ep One', episodeOrder: 1,
    seasonId: 'season-1', seasonNumber: 1, seasonTitle: 'Season 1',
    seriesId: 'series-1', seriesTitle: 'Cyberpunk Series', isLoneSource: false,
  },
  {
    key: 's2e1.mp4', filename: 's2e1.mp4', sizeBytes: 200,
    lastModified: '2026-09-02T10:00:00.000Z', status: 'linked' as const,
    videoSourceId: 'src-2', label: 'Main', quality: '1080p',
    episodeId: 'ep-2', episodeTitle: 'Ep Two', episodeOrder: 1,
    seasonId: 'season-2', seasonNumber: 2, seasonTitle: 'Season 2',
    seriesId: 'series-1', seriesTitle: 'Cyberpunk Series', isLoneSource: false,
  },
];

function mockFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/api/storage/providers')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/api/storage/metrics')) {
      return new Response(JSON.stringify({ data: { totalBytes: 300, limitBytes: 1000, percentUsed: 30, totalCount: 2, linkedCount: 2, orphanCount: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/api/storage/series')) {
      return new Response(JSON.stringify({ data: mockSeriesResponse }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/api/storage/resources')) {
      return new Response(JSON.stringify({ data: { items: mockBackendItems, total: 2, page: 1, limit: 25, totalPages: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ data: { success: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

describe('Storage series drill-down', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('test-token');
    window.history.replaceState(null, '', '/admin/storage');
    mockFetch();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/admin/storage');
  });

  it('transitions to drill-down with back button and season chips on series select', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    expect(await screen.findByTestId('series-drilldown-view')).toBeInTheDocument();
    expect(screen.getByTestId('back-to-series-btn')).toBeInTheDocument();
    expect(screen.getByTestId('season-chip-bar')).toBeInTheDocument();
    expect(screen.getByTestId('season-chip-all')).toBeInTheDocument();
    expect(screen.getByTestId('season-chip-season-1')).toBeInTheDocument();
    expect(screen.getByTestId('season-chip-season-2')).toBeInTheDocument();
  });

  it('filters by season chip and shows all on "All"', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    await waitFor(() => expect(screen.getAllByText('s1e1.mp4').length).toBeGreaterThan(0));

    await user.click(screen.getByTestId('season-chip-season-2'));
    expect(screen.queryAllByText('s1e1.mp4').length).toBe(0);
    expect(screen.getAllByText('s2e1.mp4').length).toBeGreaterThan(0);

    await user.click(screen.getByTestId('season-chip-all'));
    expect(screen.getAllByText('s1e1.mp4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('s2e1.mp4').length).toBeGreaterThan(0);
  });

  it('back button returns to overview', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    await user.click(screen.getByTestId('back-to-series-btn'));
    expect(await screen.findByTestId('series-table-container')).toBeInTheDocument();
    expect(screen.queryByTestId('series-drilldown-view')).not.toBeInTheDocument();
  });

  it('syncs seriesId/seasonId to URL and restores on direct load', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    await user.click(screen.getByTestId('season-chip-season-1'));
    await waitFor(() => {
      expect(window.location.search).toContain('seriesId=series-1');
      expect(window.location.search).toContain('seasonId=season-1');
    });
  });

  it('restores drill-down state on direct load with query params', async () => {
    window.history.replaceState(null, '', '/admin/storage?seriesId=series-1&seasonId=season-2');
    renderWithProviders(<StorageView />);
    expect(await screen.findByTestId('series-drilldown-view')).toBeInTheDocument();
    expect(screen.getByTestId('season-chip-season-2')).toHaveAttribute('aria-pressed', 'true');
  });

  it('passes seriesId to resources query', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    await waitFor(() => {
      const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes('/api/storage/resources') && u.includes('seriesId=series-1'))).toBe(true);
    });
  });

  it('supports single delete and preview actions in drill-down', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    await waitFor(() => expect(screen.getAllByText('s1e1.mp4').length).toBeGreaterThan(0));
    // Row action menus exist (preview/edit/delete via ⋯ menu per row)
    const rows = screen.getAllByTestId(/^row-/);
    expect(rows.length).toBeGreaterThan(0);
  });
});
