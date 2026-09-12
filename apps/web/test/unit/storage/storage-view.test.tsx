import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setAccessToken } from '@/lib/api';
import { StorageView } from '@/modules/storage';
import { StorageMetricsGrid } from '@/modules/storage/internal/StorageMetricsGrid';
import { StorageLimitDialog } from '@/modules/storage/internal/StorageLimitDialog';
import { EditSourceModal } from '@/modules/storage/internal/EditSourceModal';
import { DeleteConfirmDialog } from '@/modules/storage/internal/DeleteConfirmDialog';
import { VideoPreviewModal } from '@/modules/storage/internal/VideoPreviewModal';
import type { StorageMetrics, StorageResource } from '@/modules/storage';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));

const mockMetrics: StorageMetrics = {
  totalSizeBytes: 10737418240, // 10 GB
  limitSizeBytes: 53687091200, // 50 GB
  percentUsed: 20.0,
  totalFiles: 4,
  linkedFiles: 2,
  orphanedFiles: 2,
};

const mockResources: StorageResource[] = [
  {
    id: 'src-1',
    key: 'movies/big_buck_bunny.mp4',
    filename: 'big_buck_bunny.mp4',
    sizeBytes: 5368709120, // 5 GB
    lastModified: '2026-09-01T10:00:00.000Z',
    status: 'linked',
    isLoneSource: true,
    videoSource: {
      id: 'src-1',
      label: 'Main 1080p',
      quality: '1080p',
      episodeId: 'ep-1',
    },
    episode: {
      id: 'ep-1',
      title: 'Episode One',
      episodeNumber: 1,
      seasonNumber: 1,
      seriesId: 'series-1',
      seriesTitle: 'Cyberpunk Series',
      sourceCount: 1, // Sole video source!
    },
  },
  {
    id: 'src-2',
    key: 'movies/small_clip.mp4',
    filename: 'small_clip.mp4',
    sizeBytes: 1073741824, // 1 GB
    lastModified: '2026-09-05T12:00:00.000Z',
    status: 'linked',
    isLoneSource: false,
    videoSource: {
      id: 'src-2',
      label: 'Secondary 720p',
      quality: '720p',
      episodeId: 'ep-2',
    },
    episode: {
      id: 'ep-2',
      title: 'Episode Two',
      episodeNumber: 2,
      seasonNumber: 1,
      seriesId: 'series-1',
      seriesTitle: 'Cyberpunk Series',
      sourceCount: 2, // Multiple sources
    },
  },
  {
    id: 'orphans/unlinked_trailer.mp4',
    key: 'orphans/unlinked_trailer.mp4',
    filename: 'unlinked_trailer.mp4',
    sizeBytes: 3221225472, // 3 GB
    lastModified: '2026-08-20T08:00:00.000Z',
    status: 'orphaned',
    isLoneSource: false,
  },
  {
    id: 'orphans/temp_chunk.bin',
    key: 'orphans/temp_chunk.bin',
    filename: 'temp_chunk.bin',
    sizeBytes: 1073741824, // 1 GB
    lastModified: '2026-08-15T08:00:00.000Z',
    status: 'orphaned',
    isLoneSource: false,
  },
];

const mockBackendItems = [
  {
    key: 'movies/big_buck_bunny.mp4',
    filename: 'big_buck_bunny.mp4',
    sizeBytes: 5368709120,
    lastModified: '2026-09-01T10:00:00.000Z',
    status: 'linked' as const,
    videoSourceId: 'src-1',
    label: 'Main 1080p',
    quality: '1080p',
    episodeId: 'ep-1',
    episodeTitle: 'Episode One',
    episodeOrder: 1,
    seasonId: 'season-1',
    seasonNumber: 1,
    seasonTitle: 'Season 1',
    seriesId: 'series-1',
    seriesTitle: 'Cyberpunk Series',
    isLoneSource: true,
  },
  {
    key: 'movies/small_clip.mp4',
    filename: 'small_clip.mp4',
    sizeBytes: 1073741824,
    lastModified: '2026-09-05T12:00:00.000Z',
    status: 'linked' as const,
    videoSourceId: 'src-2',
    label: 'Secondary 720p',
    quality: '720p',
    episodeId: 'ep-2',
    episodeTitle: 'Episode Two',
    episodeOrder: 2,
    seasonId: 'season-1',
    seasonNumber: 1,
    seasonTitle: 'Season 1',
    seriesId: 'series-1',
    seriesTitle: 'Cyberpunk Series',
    isLoneSource: false,
  },
  {
    key: 'orphans/unlinked_trailer.mp4',
    filename: 'unlinked_trailer.mp4',
    sizeBytes: 3221225472,
    lastModified: '2026-08-20T08:00:00.000Z',
    status: 'orphaned' as const,
    videoSourceId: null,
    label: null,
    quality: null,
    episodeId: null,
    episodeTitle: null,
    episodeOrder: null,
    seasonId: null,
    seasonNumber: null,
    seasonTitle: null,
    seriesId: null,
    seriesTitle: null,
    isLoneSource: false,
  },
  {
    key: 'orphans/temp_chunk.bin',
    filename: 'temp_chunk.bin',
    sizeBytes: 1073741824,
    lastModified: '2026-08-15T08:00:00.000Z',
    status: 'orphaned' as const,
    videoSourceId: null,
    label: null,
    quality: null,
    episodeId: null,
    episodeTitle: null,
    episodeOrder: null,
    seasonId: null,
    seasonNumber: null,
    seasonTitle: null,
    seriesId: null,
    seriesTitle: null,
    isLoneSource: false,
  },
];

describe('Storage Management Console UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('test-access-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/storage/providers/test')) {
        return new Response(
          JSON.stringify({ data: { success: true, message: 'Bucket connected successfully', latencyMs: 42 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/storage/providers')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'prov-1',
                name: 'Backblaze B2 Main',
                providerType: 'backblaze',
                endpoint: 'https://s3.us-west-002.backblazeb2.com',
                region: 'us-west-002',
                bucket: 'main-bucket',
                accessKeyIdMasked: '••••1234',
                publicBaseUrl: 'https://cdn.private-movie.com',
                forcePathStyle: false,
                storageLimitGb: 50,
                isDefault: true,
                isEnabled: true,
                linkedSourcesCount: 2,
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
              },
              {
                id: 'prov-2',
                name: 'Cloudflare R2 Secondary',
                providerType: 'cloudflare_r2',
                endpoint: 'https://account.r2.cloudflarestorage.com',
                region: 'auto',
                bucket: 'r2-bucket',
                accessKeyIdMasked: '••••5678',
                publicBaseUrl: null,
                forcePathStyle: false,
                storageLimitGb: 100,
                isDefault: false,
                isEnabled: true,
                linkedSourcesCount: 0,
                createdAt: '2026-09-02T00:00:00.000Z',
                updatedAt: '2026-09-02T00:00:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/storage/metrics')) {
        return new Response(
          JSON.stringify({
            data: {
              totalBytes: 10737418240,
              limitBytes: 53687091200,
              percentUsed: 20.0,
              totalCount: 4,
              linkedCount: 2,
              orphanCount: 2,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/storage/resources/preview-url')) {
        return new Response(
          JSON.stringify({ data: { previewUrl: 'https://preview.s3.com/stream.mp4' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/storage/resources')) {
        return new Response(
          JSON.stringify({
            data: {
              items: mockBackendItems,
              total: 4,
              page: 1,
              limit: 10,
              totalPages: 1,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ data: { success: true } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('StorageMetricsGrid component', () => {
    it('renders storage capacity bar and metric summary cards', () => {
      renderWithProviders(
        <StorageMetricsGrid
          metrics={mockMetrics}
          onOpenLimitDialog={vi.fn()}
        />
      );

      expect(screen.getByText('Storage Capacity')).toBeInTheDocument();
      expect(screen.getByTestId('threshold-badge')).toHaveTextContent('20.0% Used');
      expect(screen.getByTestId('capacity-progress-bar')).toHaveStyle({ width: '20%' });

      expect(screen.getByTestId('metric-total-size')).toHaveTextContent('10 GB');
      expect(screen.getByTestId('metric-total-files')).toHaveTextContent('4');
      expect(screen.getByTestId('metric-linked-files')).toHaveTextContent('2');
      expect(screen.getByTestId('metric-orphaned-files')).toHaveTextContent('2');
    });

    it('shifts threshold colors to amber at >=80% and red at >=90%', () => {
      const amberMetrics: StorageMetrics = { ...mockMetrics, percentUsed: 82.5 };
      const { rerender } = renderWithProviders(
        <StorageMetricsGrid metrics={amberMetrics} onOpenLimitDialog={vi.fn()} />
      );

      let badge = screen.getByTestId('threshold-badge');
      expect(badge.className).toContain('amber');

      const redMetrics: StorageMetrics = { ...mockMetrics, percentUsed: 95.0 };
      rerender(<StorageMetricsGrid metrics={redMetrics} onOpenLimitDialog={vi.fn()} />);

      badge = screen.getByTestId('threshold-badge');
      expect(badge.className).toContain('red');
    });

    it('triggers onOpenLimitDialog when Adjust Limit button is clicked', async () => {
      const onOpenLimitDialog = vi.fn();
      const { user } = renderWithProviders(
        <StorageMetricsGrid metrics={mockMetrics} onOpenLimitDialog={onOpenLimitDialog} />
      );

      await user.click(screen.getByTestId('adjust-limit-btn'));
      expect(onOpenLimitDialog).toHaveBeenCalledTimes(1);
    });
  });

  describe('StorageLimitDialog component', () => {
    it('allows inputting new quota in GB and calling onSave', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onOpenChange = vi.fn();

      const { user } = renderWithProviders(
        <StorageLimitDialog
          open={true}
          onOpenChange={onOpenChange}
          currentLimitGb={50}
          onSave={onSave}
        />
      );

      const input = screen.getByLabelText(/Capacity Limit \(GB\)/i);
      expect(input).toHaveValue(50);

      await user.clear(input);
      await user.type(input, '100');

      await user.click(screen.getByTestId('save-limit-btn'));
      expect(onSave).toHaveBeenCalledWith(100);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('displays error message when entering invalid quota', async () => {
      const onSave = vi.fn();
      const { user } = renderWithProviders(
        <StorageLimitDialog
          open={true}
          onOpenChange={vi.fn()}
          currentLimitGb={50}
          onSave={onSave}
        />
      );

      const input = screen.getByLabelText(/Capacity Limit \(GB\)/i);
      await user.clear(input);
      await user.type(input, '-10');

      await user.click(screen.getByTestId('save-limit-btn'));
      expect(screen.getByTestId('limit-error-msg')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('StorageResourceTable component & filtering/sorting', () => {
    it('renders resource table with items sorted by size descending by default', async () => {
      renderWithProviders(<StorageView />);

      await waitFor(() => {
        expect(screen.getByText('big_buck_bunny.mp4')).toBeInTheDocument();
      });

      // Wait until loading finishes and table renders rows
      await waitFor(() => {
        const rows = screen.getAllByTestId(/^row-/);
        expect(rows.length).toBe(4);
        expect(rows[0]).toHaveTextContent('big_buck_bunny.mp4'); // 5 GB
        expect(rows[1]).toHaveTextContent('unlinked_trailer.mp4'); // 3 GB
      });
    });

    it('filters resources by status tabs (All, Linked, Orphaned)', async () => {
      const { user } = renderWithProviders(<StorageView />);

      await waitFor(() => {
        expect(screen.getByText('big_buck_bunny.mp4')).toBeInTheDocument();
      });

      // Click "Linked" filter tab
      await user.click(screen.getByTestId('filter-tab-linked'));
      expect(screen.getByText('big_buck_bunny.mp4')).toBeInTheDocument();
      expect(screen.getByText('small_clip.mp4')).toBeInTheDocument();
      expect(screen.queryByText('unlinked_trailer.mp4')).not.toBeInTheDocument();

      // Click "Orphaned" filter tab
      await user.click(screen.getByTestId('filter-tab-orphaned'));
      expect(screen.getByText('unlinked_trailer.mp4')).toBeInTheDocument();
      expect(screen.queryByText('big_buck_bunny.mp4')).not.toBeInTheDocument();
    });

    it('searches resources by filename or series title', async () => {
      const { user } = renderWithProviders(<StorageView />);

      await waitFor(() => {
        expect(screen.getByText('big_buck_bunny.mp4')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('storage-search-input');
      await user.type(searchInput, 'trailer');

      expect(screen.getByText('unlinked_trailer.mp4')).toBeInTheDocument();
      expect(screen.queryByText('big_buck_bunny.mp4')).not.toBeInTheDocument();
    });

    it('sorts columns by name when clicking name header', async () => {
      const { user } = renderWithProviders(<StorageView />);

      await waitFor(() => {
        expect(screen.getByText('big_buck_bunny.mp4')).toBeInTheDocument();
      });

      // Click Name sort header
      await user.click(screen.getByTestId('sort-header-name'));

      const rows = screen.getAllByTestId(/^row-/);
      // Descending alphabetically by default on click
      expect(rows[0]).toHaveTextContent('unlinked_trailer.mp4');
    });

    it('supports batch selection and batch toolbar display', async () => {
      const { user } = renderWithProviders(<StorageView />);

      await waitFor(() => {
        expect(screen.getByText('big_buck_bunny.mp4')).toBeInTheDocument();
      });

      const selectAll = screen.getByTestId('select-all-checkbox');
      await user.click(selectAll);

      expect(screen.getByTestId('batch-toolbar')).toBeInTheDocument();
      expect(screen.getByTestId('delete-selected-btn')).toHaveTextContent('Delete Selected (4)');
    });
  });

  describe('EditSourceModal component', () => {
    it('allows editing label and quality for linked source', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onOpenChange = vi.fn();

      const { user } = renderWithProviders(
        <EditSourceModal
          open={true}
          onOpenChange={onOpenChange}
          videoSource={{ id: 'src-1', label: 'Main 1080p', quality: '1080p', episodeId: 'ep-1', key: 'movies/big_buck_bunny.mp4' }}
          onSave={onSave}
        />
      );

      const labelInput = screen.getByLabelText(/Source Label/i);
      expect(labelInput).toHaveValue('Main 1080p');

      await user.clear(labelInput);
      await user.type(labelInput, 'Updated 4K Source');

      await user.click(screen.getByTestId('save-source-btn'));
      expect(onSave).toHaveBeenCalledWith('src-1', {
        label: 'Updated 4K Source',
        quality: '1080p',
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('DeleteConfirmDialog component & warnings', () => {
    it('displays single deletion prompt and warns if episode sole video source is being deleted', () => {
      renderWithProviders(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          targetType="single"
          targetResource={mockResources[0]} // ep-1 has sourceCount: 1
          onConfirm={vi.fn()}
        />
      );

      expect(screen.getByTestId('delete-file-count')).toHaveTextContent('1');
      expect(screen.getByTestId('reclaimed-space')).toHaveTextContent('5 GB');

      // Warning badge MUST appear
      const warning = screen.getByTestId('sole-source-warning');
      expect(warning).toBeInTheDocument();
      expect(warning).toHaveTextContent(/Last Remaining Video Source/i);
      expect(warning).toHaveTextContent('Cyberpunk Series');
    });

    it('does not display warning badge when deleting resource with multiple sources available', () => {
      renderWithProviders(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          targetType="single"
          targetResource={mockResources[1]} // ep-2 has sourceCount: 2
          onConfirm={vi.fn()}
        />
      );

      expect(screen.queryByTestId('sole-source-warning')).not.toBeInTheDocument();
    });

    it('triggers onConfirm when Confirm Delete is clicked', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      const onOpenChange = vi.fn();

      const { user } = renderWithProviders(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={onOpenChange}
          targetType="single"
          targetResource={mockResources[2]} // orphaned file
          onConfirm={onConfirm}
        />
      );

      await user.click(screen.getByTestId('confirm-delete-btn'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('VideoPreviewModal component', () => {
    it('fetches presigned URL and renders video player modal', async () => {
      renderWithProviders(
        <VideoPreviewModal
          open={true}
          onOpenChange={vi.fn()}
          fileKey="movies/big_buck_bunny.mp4"
          filename="big_buck_bunny.mp4"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Preview Video: big_buck_bunny.mp4/i)).toBeInTheDocument();
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/resources/preview-url?key=movies/big_buck_bunny.mp4'),
        expect.any(Object)
      );
    });
  });

  describe('Unconfigured S3 / Error state display', () => {
    it('displays error alert banner when S3 storage returns an error', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 'S3_NOT_CONFIGURED',
              message: 'S3 storage service is not configured',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      });

      renderWithProviders(<StorageView />);

      await waitFor(() => {
        expect(screen.getByTestId('storage-error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/S3 storage service is not configured/i)).toBeInTheDocument();
    });
  });

  describe('Multi-Provider Storage Console Features', () => {
    it('renders provider tabs and switches active provider view', async () => {
      const { user } = renderWithProviders(<StorageView />);

      await waitFor(() => {
        expect(screen.getByTestId('provider-tab-prov-1')).toBeInTheDocument();
        expect(screen.getByTestId('provider-tab-prov-2')).toBeInTheDocument();
      });

      // Default provider is selected initially
      expect(screen.getByTestId('provider-tab-prov-1')).toHaveTextContent('Backblaze B2 Main');
      expect(screen.getByTestId('provider-tab-prov-1')).toHaveTextContent('Def');

      // Click second provider tab
      await user.click(screen.getByTestId('provider-tab-prov-2'));

      // Check fetch called with providerId=prov-2 for metrics & resources
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining('providerId=prov-2'),
          expect.any(Object)
        );
      });
    });

    it('opens Manage Providers drawer displaying providers with status badges', async () => {
      const { user } = renderWithProviders(<StorageView />);

      await waitFor(() => {
        expect(screen.getByTestId('manage-providers-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('manage-providers-btn'));

      expect(await screen.findByTestId('manage-providers-drawer')).toBeInTheDocument();
      expect(screen.getByTestId('provider-card-prov-1')).toBeInTheDocument();
      expect(screen.getByTestId('provider-card-prov-2')).toBeInTheDocument();

      // Check badges
      expect(screen.getByTestId('badge-default')).toHaveTextContent('Default');
      expect(screen.getByText('backblaze')).toBeInTheDocument();
      expect(screen.getByText('cloudflare_r2')).toBeInTheDocument();
    });

    it('supports testing connection from provider form', async () => {
      const { user } = renderWithProviders(<StorageView />);

      await waitFor(() => {
        expect(screen.getByTestId('manage-providers-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('manage-providers-btn'));

      expect(await screen.findByTestId('add-provider-btn')).toBeInTheDocument();
      await user.click(screen.getByTestId('add-provider-btn'));

      expect(screen.getByTestId('provider-form')).toBeInTheDocument();

      // Preset change autofills endpoint & region
      const presetSelect = screen.getByTestId('provider-preset-select');
      await user.selectOptions(presetSelect, 'wasabi');

      const endpointInput = screen.getByTestId('provider-endpoint-input');
      expect(endpointInput).toHaveValue('https://s3.wasabisys.com');

      // Click Test Connection
      const testBtn = screen.getByTestId('test-connection-btn');
      await user.click(testBtn);

      await waitFor(() => {
        expect(screen.getByTestId('connection-test-result')).toBeInTheDocument();
        expect(screen.getByText('Connection Successful')).toBeInTheDocument();
      });
    });

    it('shows 409 Conflict reason dialog warning when deleting a provider with linked sources fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method || (input instanceof Request ? input.method : 'GET');
        if (url.includes('/api/storage/providers/prov-1') && method === 'DELETE') {
          return new Response(
            JSON.stringify({
              error: {
                code: 'STORAGE_PROVIDER_IN_USE',
                message: 'Cannot delete storage provider: 2 video source(s) are currently stored in this provider',
              },
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/api/storage/metrics')) {
          return new Response(
            JSON.stringify({
              data: {
                totalBytes: 10737418240,
                limitBytes: 53687091200,
                percentUsed: 20.0,
                totalCount: 4,
                linkedCount: 2,
                orphanCount: 2,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/api/storage/resources')) {
          return new Response(
            JSON.stringify({
              data: {
                items: mockBackendItems,
                total: 4,
                page: 1,
                limit: 10,
                totalPages: 1,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/api/storage/providers')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: 'prov-1',
                  name: 'Backblaze B2 Main',
                  providerType: 'backblaze',
                  endpoint: 'https://s3.us-west-002.backblazeb2.com',
                  region: 'us-west-002',
                  bucket: 'main-bucket',
                  accessKeyIdMasked: '••••1234',
                  publicBaseUrl: null,
                  forcePathStyle: false,
                  storageLimitGb: 50,
                  isDefault: true,
                  isEnabled: true,
                  linkedSourcesCount: 2,
                  createdAt: '2026-09-01T00:00:00.000Z',
                  updatedAt: '2026-09-01T00:00:00.000Z',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ data: { success: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const { user } = renderWithProviders(<StorageView />);

      await waitFor(() => {
        expect(screen.getByTestId('manage-providers-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('manage-providers-btn'));

      const deleteBtn = await screen.findByTestId('delete-provider-btn-prov-1');
      await user.click(deleteBtn);

      expect(screen.getByTestId('delete-provider-alert')).toBeInTheDocument();

      // Click Confirm Delete
      await user.click(screen.getByTestId('confirm-delete-provider-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error-message')).toHaveTextContent(
          /Cannot delete storage provider: 2 video source\(s\) are currently stored in this provider/i
        );
      });
    });
  });
});
