import { renderWithProviders, screen, within } from '../../utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setAccessToken } from '@/lib/api';
import { StorageView } from '@/modules/storage';
import { StorageResourceTable } from '@/modules/storage/internal/components/StorageResourceTable';
import type { StorageResource } from '@/modules/storage';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
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

describe('Storage overview chrome (no in-place drill-down)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    setAccessToken('test-token');
    mockFetch();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('always shows the top header container with global controls', async () => {
    renderWithProviders(<StorageView />);
    await screen.findByTestId('series-table-container');
    expect(screen.getByTestId('storage-page-header')).toBeInTheDocument();
    expect(screen.getByTestId('spin-up-minio-btn')).toBeInTheDocument();
    expect(screen.getByTestId('manage-providers-btn')).toBeInTheDocument();
    expect(await screen.findByTestId('storage-metrics-grid')).toBeInTheDocument();
  });

  it('navigates to the series route on row click instead of drilling down in place', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/admin/storage/$seriesId',
        params: { seriesId: 'series-1' },
      })
    );
    // Overview chrome stays put: header, metrics, and tabs remain visible
    expect(screen.getByTestId('storage-page-header')).toBeInTheDocument();
    expect(screen.getByTestId('storage-metrics-grid')).toBeInTheDocument();
    expect(screen.getByTestId('series-table-container')).toBeInTheDocument();
    expect(screen.queryByTestId('series-drilldown-view')).not.toBeInTheDocument();
  });

  it('retains the streamlined purge-only action bar in the overview orphaned tab', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('tab-trigger-orphaned'));
    expect(await screen.findByTestId('storage-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('purge-orphans-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('filter-tab-all')).not.toBeInTheDocument();
    expect(screen.queryByTestId('refresh-scan-btn')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('storage-search-input')
    ).not.toBeInTheDocument();
  });

  it('keeps sorting, row selection, and row actions working in the scoped detail table', async () => {
    const noop = vi.fn();
    const linked = {
      id: 'src-1',
      key: 's1e1.mp4',
      filename: 's1e1.mp4',
      sizeBytes: 100,
      lastModified: '2026-09-01T10:00:00.000Z',
      status: 'linked',
      videoSource: { id: 'src-1', label: 'Main', quality: '1080p', episodeId: 'ep-1' },
      episode: {
        id: 'ep-1',
        title: 'Ep One',
        episodeNumber: 1,
        seasonNumber: 1,
        seriesId: 'series-1',
        seriesTitle: 'Cyberpunk Series',
        sourceCount: 1,
      },
    } as StorageResource;
    const { user } = renderWithProviders(
      <StorageResourceTable
        resources={[linked]}
        onRefreshScan={noop}
        onPreview={noop}
        onEditSource={noop}
        onAttachOrphan={noop}
        onDeleteSingle={noop}
        onDeleteBatch={noop}
        onPurgeOrphans={noop}
        hideToolbar
      />
    );
    await screen.findByTestId('row-s1e1.mp4');
    // Scoped detail tables suppress the overview toolbar
    expect(screen.queryByTestId('storage-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filter-tab-all')).not.toBeInTheDocument();

    // Column sorting
    await user.click(screen.getByRole('button', { name: /filename \/ key/i }));
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
