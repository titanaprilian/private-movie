import { renderWithProviders, screen, within } from '../../utils';
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
    key: 'orphan.mp4', filename: 'orphan.mp4', sizeBytes: 50,
    lastModified: '2026-09-03T10:00:00.000Z', status: 'orphaned' as const,
    videoSourceId: null, label: null, quality: null,
    episodeId: null, episodeTitle: null, episodeOrder: null,
    seasonId: null, seasonNumber: null, seasonTitle: null,
    seriesId: null, seriesTitle: null, isLoneSource: false,
  },
];

function mockFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/api/storage/providers')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/api/storage/metrics')) {
      return new Response(JSON.stringify({ data: { totalBytes: 300, limitBytes: 1000, percentUsed: 30, totalCount: 2, linkedCount: 1, orphanCount: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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

describe('Storage drill-down declutter', () => {
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

  it('shows the top header container in Level 1 overview mode', async () => {
    renderWithProviders(<StorageView />);
    expect(await screen.findByTestId('storage-page-header')).toBeInTheDocument();
    expect(screen.getByTestId('spin-up-minio-btn')).toBeInTheDocument();
    expect(screen.getByTestId('manage-providers-btn')).toBeInTheDocument();
  });

  it('hides the top header container in drill-down mode', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    expect(screen.queryByTestId('storage-page-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spin-up-minio-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manage-providers-btn')).not.toBeInTheDocument();
  });

  it('suppresses the resource table toolbar in drill-down mode but still renders rows', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    expect(screen.queryByTestId('storage-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filter-tab-all')).not.toBeInTheDocument();
    // Scoped resources still render (stop-and-report guard).
    expect(await screen.findByTestId('row-s1e1.mp4')).toBeInTheDocument();
  });

  it('retains the toolbar with purge and filter actions in the overview orphaned tab', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('tab-trigger-orphaned'));
    expect(await screen.findByTestId('storage-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('filter-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('purge-orphans-btn')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-scan-btn')).toBeInTheDocument();
  });

  it('keeps sorting, row selection, and row actions working in the drill-down table', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    await screen.findByTestId('row-s1e1.mp4');

    // Column sorting
    await user.click(screen.getByTestId('sort-header-name'));
    expect(screen.getByTestId('row-s1e1.mp4')).toBeInTheDocument();

    // Batch row selection
    await user.click(screen.getByTestId('checkbox-s1e1.mp4'));
    expect(await screen.findByTestId('batch-toolbar')).toBeInTheDocument();

    // Individual row action menu (preview + delete for a linked video file)
    await user.click(screen.getByRole('button', { name: 'Actions for s1e1.mp4' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Preview' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });
});
