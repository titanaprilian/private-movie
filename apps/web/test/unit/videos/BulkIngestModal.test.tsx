import { renderWithProviders, screen, waitFor } from '../../utils';
import { cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BulkIngestModal } from '@/modules/videos/internal/BulkIngestModal';
import * as api from '@/modules/videos/internal/api';

const mockProviders = [
  {
    id: 'prov-b2',
    name: 'Backblaze B2 Main',
    providerType: 'backblaze_b2' as const,
    endpoint: 'https://s3.us-west-002.backblazeb2.com',
    region: 'us-west-002',
    bucket: 'b2-bucket',
    accessKeyIdMasked: '••••1234',
    publicBaseUrl: 'https://media.example.com',
    forcePathStyle: false,
    storageLimitGb: 500,
    isDefault: true,
    isEnabled: true,
    linkedSourcesCount: 5,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'prov-r2',
    name: 'Cloudflare R2 Secondary',
    providerType: 'cloudflare_r2' as const,
    endpoint: 'https://account.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'r2-bucket',
    accessKeyIdMasked: '••••5678',
    publicBaseUrl: null,
    forcePathStyle: false,
    storageLimitGb: 200,
    isDefault: false,
    isEnabled: true,
    linkedSourcesCount: 2,
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  },
];

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/modules/videos/internal/api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/videos/internal/api')>();
  return {
    ...actual,
    remoteIngestEpisodeVideoSource: vi.fn(),
    archiveIngestPreview: vi.fn(),
    archiveIngestCommit: vi.fn(),
    archiveIngestCleanup: vi.fn(),
  };
});

const mockLocalEpisodes = [
  { id: 'ep-1', title: 'Intro to Deep Modules', order: 1 },
  { id: 'ep-2', title: 'TanStack Router Setup', order: 2 },
  { id: 'ep-3', title: 'State Management', order: 3 },
];

const mockSeasons = [
  {
    id: 's1',
    title: 'Season 1',
    tmdbSeason: 1,
    episodes: mockLocalEpisodes,
  },
];

/** Helper: switch to the URL tab so URL-mode tests can proceed */
async function switchToUrlTab(user: ReturnType<typeof renderWithProviders>['user']) {
  const urlTab = await screen.findByTestId('tab-url');
  await user.click(urlTab);
  // Verify the textarea is now visible
  await screen.findByTestId('bulk-ingest-urls-textarea');
}

describe('BulkIngestModal component', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.remoteIngestEpisodeVideoSource).mockResolvedValue({
      id: 'ep-1',
      title: 'Ingested Ep',
      videoSources: [],
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(api.archiveIngestPreview).mockResolvedValue({
      stagingSessionId: 'sess-123',
      items: [
        {
          fileId: 'file-1',
          filename: 'Show.S01E01.1080p.mkv',
          fileSizeBytes: 500_000_000,
          detectedEpisodeNumber: 1,
          matchedEpisodeId: 'ep-1',
          quality: '1080p',
          needsReview: false,
        },
        {
          fileId: 'file-2',
          filename: 'Show.random_extra.mkv',
          fileSizeBytes: 50_000_000,
          detectedEpisodeNumber: null,
          matchedEpisodeId: null,
          quality: null,
          needsReview: true,
        },
      ],
    });
    vi.mocked(api.archiveIngestCommit).mockResolvedValue({ success: true, count: 1 });
    vi.mocked(api.archiveIngestCleanup).mockResolvedValue(undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url.includes('/api/auth/refresh')) {
          return new Response(JSON.stringify({ data: { accessToken: 'mock-token' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/storage/providers')) {
          return new Response(JSON.stringify({ data: mockProviders }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ data: { success: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );
  });

  it('renders nothing when open is false', () => {
    const { container } = renderWithProviders(
      <BulkIngestModal
        open={false}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Step 1 with both tabs — Archive tab active by default', () => {
    renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    expect(screen.getByText('Bulk Ingest Sources')).toBeInTheDocument();
    expect(screen.getByTestId('tab-archive')).toBeInTheDocument();
    expect(screen.getByTestId('tab-url')).toBeInTheDocument();
    // Archive tab content should be shown by default
    expect(screen.getByTestId('archive-url-input')).toBeInTheDocument();
    expect(screen.getByTestId('archive-preview-btn')).toBeInTheDocument();
  });

  // ─── URL tab regression tests ─────────────────────────────────────────────

  it('switches to URL tab and shows URL ingest Step 1 form', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    await switchToUrlTab(user);

    expect(screen.getByTestId('bulk-ingest-urls-textarea')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Target Season/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Default Quality/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Default Source Label/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Shared HTTP Referer/i)).toBeInTheDocument();
    expect(screen.getByTestId('bulk-ingest-parse-btn')).toBeInTheDocument();
  });

  it('parses URLs and moves to Step 2 upon submitting valid URLs', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    await switchToUrlTab(user);

    const textarea = screen.getByTestId('bulk-ingest-urls-textarea');
    await user.type(
      textarea,
      'https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4\nhttps://cdn.com/random_hash_99.mp4'
    );

    await user.click(screen.getByTestId('bulk-ingest-parse-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-ingest-row-0')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-ingest-row-1')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Teach.You.a.Lesson.E01.1080p.mp4')
    ).toBeInTheDocument();
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-ingest-start-btn')).toBeInTheDocument();
  });

  it('allows manual combobox re-matching and row editing in Step 2', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    await switchToUrlTab(user);

    const textarea = screen.getByTestId('bulk-ingest-urls-textarea');
    await user.type(textarea, 'https://cdn.com/random_hash_99.mp4');
    await user.click(screen.getByTestId('bulk-ingest-parse-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-ingest-row-0')).toBeInTheDocument();
    });

    const comboboxTrigger = screen.getByRole('combobox', {
      name: /Target episode for random_hash_99.mp4/i,
    });
    expect(comboboxTrigger).toHaveTextContent('-- Skip / Unmapped --');

    await user.click(comboboxTrigger);
    const ep2Option = await screen.findByText(/Ep 2: TanStack Router Setup/i);
    await user.click(ep2Option);

    expect(comboboxTrigger).toHaveTextContent('Ep 2: TanStack Router Setup');
    expect(screen.queryByText('Needs Review')).not.toBeInTheDocument();
  });

  it('transitions to Step 3, displays progress, and completes execution calling remoteIngestEpisodeVideoSource', async () => {
    const onOpenChange = vi.fn();

    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={onOpenChange}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    await switchToUrlTab(user);

    const textarea = screen.getByTestId('bulk-ingest-urls-textarea');
    await user.type(
      textarea,
      'https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4'
    );
    await user.click(screen.getByTestId('bulk-ingest-parse-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-ingest-start-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('bulk-ingest-start-btn'));

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-ingest-logs')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(api.remoteIngestEpisodeVideoSource).toHaveBeenCalledWith(
        'ep-1',
        expect.objectContaining({
          url: 'https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4',
        })
      );
    });

    const closeBtn = await screen.findByTestId('bulk-ingest-close-btn');
    await user.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders target storage provider selector in URL tab Step 1 and defaults to default provider', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    await switchToUrlTab(user);

    const providerSelectTrigger = await screen.findByRole('combobox', {
      name: /Target S3 Storage Provider/i,
    });
    expect(providerSelectTrigger).toBeInTheDocument();
    await waitFor(() => {
      expect(providerSelectTrigger).toHaveTextContent(/Backblaze B2 Main/i);
    });

    await user.click(providerSelectTrigger);
    expect(
      await screen.findByRole('option', {
        name: 'Backblaze B2 Main (Default)',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Cloudflare R2 Secondary' })
    ).toBeInTheDocument();
  });

  it('allows changing target storage provider in URL tab Step 1, displaying provider badge in Step 2 review and Step 3 progress', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    await switchToUrlTab(user);

    const providerSelectTrigger = await screen.findByRole('combobox', {
      name: /Target S3 Storage Provider/i,
    });
    await waitFor(() => {
      expect(providerSelectTrigger).toHaveTextContent(/Backblaze B2 Main/i);
    });

    await user.click(providerSelectTrigger);
    const r2Option = await screen.findByRole('option', {
      name: 'Cloudflare R2 Secondary',
    });
    await user.click(r2Option);

    expect(providerSelectTrigger).toHaveTextContent('Cloudflare R2 Secondary');

    const textarea = screen.getByTestId('bulk-ingest-urls-textarea');
    await user.type(
      textarea,
      'https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4'
    );
    await user.click(screen.getByTestId('bulk-ingest-parse-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-ingest-row-0')).toBeInTheDocument();
    });

    // Step 2 badge
    const reviewBadge = screen.getByTestId('bulk-ingest-target-provider-badge');
    expect(reviewBadge).toBeInTheDocument();
    expect(reviewBadge).toHaveTextContent('Cloudflare R2 Secondary');

    // Step 3 progress view
    await user.click(screen.getByTestId('bulk-ingest-start-btn'));
    await waitFor(() => {
      expect(
        screen.getByTestId('bulk-ingest-progress-provider')
      ).toHaveTextContent('Cloudflare R2 Secondary');
    });

    expect(api.remoteIngestEpisodeVideoSource).toHaveBeenCalledWith(
      'ep-1',
      expect.objectContaining({
        storageProviderId: 'prov-r2',
      })
    );
  });

  it('omits storage provider dropdown in URL tab when no storage providers exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url.includes('/api/storage/providers')) {
          return new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ data: { success: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    await switchToUrlTab(user);

    // Wait for queries to settle
    await screen.findByTestId('bulk-ingest-urls-textarea');
    expect(
      screen.queryByTestId('bulk-ingest-storage-provider-select')
    ).not.toBeInTheDocument();
  });

  // ─── Archive tab tests ────────────────────────────────────────────────────

  it('renders Archive tab (default) with archive URL input and Preview button', async () => {
    renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    // Archive is default tab
    expect(screen.getByTestId('archive-url-input')).toBeInTheDocument();
    expect(screen.getByTestId('archive-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('archive-preview-btn')).toBeInTheDocument();
  });

  it('archive tab: calls archiveIngestPreview with URL and moves to Step 2 review', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    const archiveUrlInput = screen.getByTestId('archive-url-input');
    await user.type(archiveUrlInput, 'https://example.com/season1.zip');
    await user.click(screen.getByTestId('archive-preview-btn'));

    await waitFor(() => {
      expect(api.archiveIngestPreview).toHaveBeenCalledWith(
        'series-100',
        expect.objectContaining({ url: 'https://example.com/season1.zip' }),
        expect.any(Object)
      );
    });

    // Should advance to Step 2 review
    await waitFor(() => {
      expect(screen.getByTestId('archive-review-row-0')).toBeInTheDocument();
    });

    expect(screen.getByText('Show.S01E01.1080p.mkv')).toBeInTheDocument();
    expect(screen.getByText('Show.random_extra.mkv')).toBeInTheDocument();
    expect(screen.getByTestId('archive-commit-btn')).toBeInTheDocument();
  });

  it('archive tab: review shows Needs Review badge for unmatched files', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    const archiveUrlInput = screen.getByTestId('archive-url-input');
    await user.type(archiveUrlInput, 'https://example.com/season1.zip');
    await user.click(screen.getByTestId('archive-preview-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('archive-review-row-1')).toBeInTheDocument();
    });

    // The second item (index 1) has no episode match — should show Needs Review
    const row1 = screen.getByTestId('archive-review-row-1');
    expect(row1).toHaveTextContent('Needs Review');
  });

  it('archive tab: commit calls archiveIngestCommit and shows progress in Step 3', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    // Step 1: enter URL and preview
    await user.type(screen.getByTestId('archive-url-input'), 'https://example.com/season1.zip');
    await user.click(screen.getByTestId('archive-preview-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('archive-commit-btn')).toBeInTheDocument();
    });

    // Step 2: commit
    await user.click(screen.getByTestId('archive-commit-btn'));

    // Step 3: progress
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByTestId('archive-commit-logs')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(api.archiveIngestCommit).toHaveBeenCalledWith(
        'series-100',
        expect.objectContaining({
          stagingSessionId: 'sess-123',
          items: expect.arrayContaining([
            expect.objectContaining({ fileId: 'file-1', episodeId: 'ep-1' }),
          ]),
        }),
        expect.any(Object)
      );
    });

    // Close button should appear after commit resolves
    const closeBtn = await screen.findByTestId('archive-commit-close-btn');
    expect(closeBtn).toBeInTheDocument();
  });

  it('archive tab: closing modal calls archiveIngestCleanup when a session exists', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={onOpenChange}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    // Preview to establish staging session
    await user.type(screen.getByTestId('archive-url-input'), 'https://example.com/season1.zip');
    await user.click(screen.getByTestId('archive-preview-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('archive-commit-btn')).toBeInTheDocument();
    });

    // Commit
    await user.click(screen.getByTestId('archive-commit-btn'));

    const closeBtn = await screen.findByTestId('archive-commit-close-btn');
    await user.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('archive tab: shows storage provider badge in Step 2 review', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    // Wait for provider to load
    await waitFor(async () => {
      const storageCombobox = screen.queryByRole('combobox', {
        name: /Target S3 Storage Provider/i,
      });
      expect(storageCombobox).toBeTruthy();
    });

    // Do archive preview
    await user.type(screen.getByTestId('archive-url-input'), 'https://example.com/season1.zip');
    await user.click(screen.getByTestId('archive-preview-btn'));

    // Step 2 review should show provider badge
    await waitFor(() => {
      const badge = screen.getByTestId('archive-ingest-target-provider-badge');
      expect(badge).toHaveTextContent('Backblaze B2 Main');
    });
  });

  it('archive tab: ignore toggle hides item from commit count', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    await user.type(screen.getByTestId('archive-url-input'), 'https://example.com/season1.zip');
    await user.click(screen.getByTestId('archive-preview-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('archive-review-row-0')).toBeInTheDocument();
    });

    // Initial commit button shows 1 matched (file-1 matched to ep-1)
    expect(screen.getByTestId('archive-commit-btn')).toHaveTextContent('Commit to S3 (1)');

    // Ignore the matched file
    const row0 = screen.getByTestId('archive-review-row-0');
    const ignoreBtn = row0.querySelector('button[type="button"]');
    if (ignoreBtn) await user.click(ignoreBtn);

    // Now commit count should be 0
    await waitFor(() => {
      expect(screen.getByTestId('archive-commit-btn')).toHaveTextContent('Commit to S3 (0)');
    });
  });
});
