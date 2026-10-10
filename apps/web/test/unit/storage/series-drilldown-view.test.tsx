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

describe('Focused series drill-down view', () => {
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

  it('shows the metrics grid on the Level 1 overview', async () => {
    renderWithProviders(<StorageView />);
    await screen.findByTestId('series-table-container');
    expect(await screen.findByTestId('storage-metrics-grid')).toBeInTheDocument();
    expect(screen.getByTestId('capacity-progress-bar')).toBeInTheDocument();
  });

  it('hides the metrics grid when drilled down into a series', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    await waitFor(() => {
      expect(screen.queryByTestId('storage-metrics-grid')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('capacity-progress-bar')).not.toBeInTheDocument();
  });

  it('renders the standard BackButton with "Back to series" label at the top of the drill-down', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    const backBtn = screen.getByTestId('back-to-series-btn');
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveTextContent('Back to series');
    expect(backBtn.tagName).toBe('BUTTON');
  });

  it('returns to the overview and restores the metrics grid when the back button is clicked', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    await user.click(screen.getByTestId('back-to-series-btn'));
    expect(await screen.findByTestId('series-table-container')).toBeInTheDocument();
    expect(await screen.findByTestId('storage-metrics-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('series-drilldown-view')).not.toBeInTheDocument();
  });

  it('renders series title, season chips bar, and scoped resource table beneath the back button', async () => {
    const { user } = renderWithProviders(<StorageView />);
    await user.click(await screen.findByTestId('series-row-series-1'));
    await screen.findByTestId('series-drilldown-view');
    expect(screen.getByTestId('drilldown-series-title')).toHaveTextContent('Cyberpunk Series');
    expect(screen.getByTestId('season-chip-bar')).toBeInTheDocument();
    expect(screen.getByTestId('season-chip-all')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('s1e1.mp4').length).toBeGreaterThan(0));
    // Back button precedes the title in document order
    const backBtn = screen.getByTestId('back-to-series-btn');
    const title = screen.getByTestId('drilldown-series-title');
    expect(backBtn.compareDocumentPosition(title)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});
