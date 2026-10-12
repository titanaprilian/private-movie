import { renderWithProviders, renderHook, createTestQueryClient, screen, waitFor } from '../../utils';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { ArchiveStep1 } from '@/modules/videos/internal/ingestion/bulk/components/archive/ArchiveStep1';
import { ArchiveStep2 } from '@/modules/videos/internal/ingestion/bulk/components/archive/ArchiveStep2';
import { ArchiveStep3 } from '@/modules/videos/internal/ingestion/bulk/components/archive/ArchiveStep3';
import { UrlStep1 } from '@/modules/videos/internal/ingestion/bulk/components/url/UrlStep1';
import { UrlStep2 } from '@/modules/videos/internal/ingestion/bulk/components/url/UrlStep2';
import { UrlStep3 } from '@/modules/videos/internal/ingestion/bulk/components/url/UrlStep3';
import { BulkIngestTabs } from '@/modules/videos/internal/ingestion/bulk/components/BulkIngestTabs';
import { useBulkIngestModal } from '@/modules/videos/internal/ingestion/hooks/useBulkIngestModal';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/modules/storage', () => ({
  storageProvidersQueryOptions: () => ({
    queryKey: ['storage-providers'],
    queryFn: async () => [],
  }),
}));

const noop = () => {};

const mockSeasons = [
  {
    id: 's1',
    title: 'Season 1',
    tmdbSeason: 1,
    episodes: [
      { id: 'ep-1', title: 'Pilot', order: 1 },
      { id: 'ep-2', title: 'Second', order: 2 },
    ],
  },
];

const mockLocalEpisodes = [
  { id: 'ep-1', title: 'Pilot', order: 1 },
  { id: 'ep-2', title: 'Second', order: 2 },
];

describe('bulk ingest step components', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ArchiveStep1 renders input, preview button and provider select', () => {
    renderWithProviders(
      <ArchiveStep1
        archiveUrl=""
        setArchiveUrl={noop}
        archivePassword=""
        setArchivePassword={noop}
        archiveReferer=""
        setArchiveReferer={noop}
        defaultLabel="S3 Video"
        setDefaultLabel={noop}
        selectedSeasonId=""
        setSelectedSeasonId={noop}
        seasonOptions={[]}
        storageProviders={[]}
        selectedStorageProviderId=""
        setSelectedStorageProviderId={noop}
        previewPhase="idle"
        previewError={null}
        downloadProgress={null}
        extractProgress={null}
        onStartPreview={noop}
        onCancel={noop}
        onCancelJob={noop}
        onRetry={noop}
      />
    );
    expect(screen.getByTestId('archive-url-input')).toBeInTheDocument();
    expect(screen.getByTestId('archive-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('archive-preview-btn')).toBeInTheDocument();
  });

  it('ArchiveStep1 shows downloading progress with byte metrics', () => {
    renderWithProviders(
      <ArchiveStep1
        archiveUrl="https://example.com/s.zip"
        setArchiveUrl={noop}
        archivePassword=""
        setArchivePassword={noop}
        archiveReferer=""
        setArchiveReferer={noop}
        defaultLabel="S3 Video"
        setDefaultLabel={noop}
        selectedSeasonId=""
        setSelectedSeasonId={noop}
        seasonOptions={[]}
        storageProviders={[]}
        selectedStorageProviderId=""
        setSelectedStorageProviderId={noop}
        previewPhase="downloading"
        previewError={null}
        downloadProgress={{ loaded: 100, total: 1000, percent: 10 }}
        extractProgress={null}
        onStartPreview={noop}
        onCancel={noop}
        onCancelJob={noop}
        onRetry={noop}
      />
    );
    expect(screen.getByTestId('archive-preview-progress')).toBeInTheDocument();
    expect(screen.getByTestId('archive-download-bytes')).toBeInTheDocument();
    expect(screen.getByTestId('archive-cancel-job-btn')).toBeInTheDocument();
  });

  it('ArchiveStep2 renders review rows, counters and commit button', () => {
    renderWithProviders(
      <ArchiveStep2
        reviewItems={[
          {
            fileId: 'f1',
            filename: 'Show.S01E01.1080p.mkv',
            fileSizeBytes: 100,
            detectedEpisodeNumber: 1,
            matchedEpisodeId: 'ep-1',
            quality: '1080p',
            needsReview: false,
            isIgnored: false,
            label: 'S3 Video',
            commitStatus: 'pending',
          },
          {
            fileId: 'f2',
            filename: 'random.mkv',
            fileSizeBytes: 50,
            detectedEpisodeNumber: null,
            matchedEpisodeId: null,
            quality: null,
            needsReview: true,
            isIgnored: false,
            label: 'S3 Video',
            commitStatus: 'pending',
          },
        ]}
        totalCount={2}
        matchedCount={1}
        needsReviewCount={1}
        selectedProviderName="Backblaze B2 Main"
        updateReviewMapping={noop}
        updateReviewLabel={noop}
        updateReviewQuality={noop}
        toggleReviewIgnore={noop}
        seasons={mockSeasons}
        localEpisodes={mockLocalEpisodes}
        onBack={noop}
        onCommit={noop}
        onCancelJob={noop}
      />
    );
    expect(screen.getByTestId('archive-review-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('archive-review-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('archive-ingest-target-provider-badge')).toHaveTextContent('Backblaze B2 Main');
    expect(screen.getByTestId('archive-commit-btn')).toHaveTextContent('Commit to S3 (1)');
  });

  it('ArchiveStep3 renders upload progress, counter and logs', () => {
    renderWithProviders(
      <ArchiveStep3
        reviewItems={[
          {
            fileId: 'f1',
            filename: 'Show.S01E01.1080p.mkv',
            fileSizeBytes: 100,
            detectedEpisodeNumber: 1,
            matchedEpisodeId: 'ep-1',
            quality: '1080p',
            needsReview: false,
            isIgnored: false,
            label: 'S3 Video',
            commitStatus: 'uploading',
          },
        ]}
        totalCount={1}
        commitCompletedCount={0}
        progressPercentage={50}
        activeCommitItem={null}
        uploadView={{ currentIndex: 1, totalFiles: 1, activeFilename: 'Show.S01E01.1080p.mkv', percent: 50, loaded: 50, total: 100 }}
        selectedProviderName="Backblaze B2 Main"
        isCommitting
        onCancel={noop}
        onClose={noop}
      />
    );
    expect(screen.getByTestId('archive-upload-progress')).toBeInTheDocument();
    expect(screen.getByTestId('archive-upload-counter')).toBeInTheDocument();
    expect(screen.getByTestId('archive-upload-active-file')).toHaveTextContent('Show.S01E01.1080p.mkv');
    expect(screen.getByTestId('archive-commit-logs')).toBeInTheDocument();
    expect(screen.getByTestId('archive-cancel-commit-btn')).toBeInTheDocument();
  });

  it('UrlStep1 renders textarea, selects and parse button', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    renderWithProviders(
      <UrlStep1
        rawUrlsText=""
        setRawUrlsText={noop}
        urlSelectedSeasonId=""
        setUrlSelectedSeasonId={noop}
        seasonOptions={[]}
        defaultQuality=""
        setDefaultQuality={noop}
        storageProviders={[]}
        urlStorageProviderId=""
        setUrlStorageProviderId={noop}
        urlDefaultLabel="S3 Video"
        setUrlDefaultLabel={noop}
        sharedReferer=""
        setSharedReferer={noop}
        isProcessing={false}
        onSubmit={onSubmit}
        onCancel={noop}
      />
    );
    expect(screen.getByTestId('bulk-ingest-urls-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-ingest-parse-btn')).toBeInTheDocument();
  });

  it('UrlStep2 renders matching rows and start button', () => {
    renderWithProviders(
      <UrlStep2
        items={[
          {
            id: 'i1',
            url: 'https://cdn.com/E01.1080p.mp4',
            filename: 'E01.1080p.mp4',
            detectedEpisodeNumber: 1,
            matchedLocalEpisodeId: 'ep-1',
            label: 'S3 Video',
            quality: '1080p',
            isIgnored: false,
            needsReview: false,
            status: 'pending',
          },
        ]}
        urlTotalCount={1}
        urlMatchedCount={1}
        urlNeedsReviewCount={0}
        urlSelectedProviderName="Backblaze B2 Main"
        updateMapping={noop}
        updateLabel={noop}
        updateQuality={noop}
        toggleIgnore={noop}
        seasons={mockSeasons}
        localEpisodes={mockLocalEpisodes}
        onBack={noop}
        onStart={noop}
      />
    );
    expect(screen.getByTestId('bulk-ingest-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-ingest-target-provider-badge')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-ingest-start-btn')).toHaveTextContent('Start Bulk Ingestion (1)');
  });

  it('UrlStep3 renders queue progress and logs with cancel button', () => {
    renderWithProviders(
      <UrlStep3
        items={[
          {
            id: 'i1',
            url: 'https://cdn.com/E01.1080p.mp4',
            filename: 'E01.1080p.mp4',
            detectedEpisodeNumber: 1,
            matchedLocalEpisodeId: 'ep-1',
            label: 'S3 Video',
            quality: '1080p',
            isIgnored: false,
            needsReview: false,
            status: 'ingesting',
            progress: { percent: 10, loaded: 10, total: 100 },
          },
        ]}
        urlTotalCount={1}
        urlProgressPercentage={0}
        completedCount={0}
        activeItem={null}
        urlSelectedProviderName="Backblaze B2 Main"
        isProcessing
        onCancelQueue={noop}
        onClose={noop}
      />
    );
    expect(screen.getByTestId('bulk-ingest-logs')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-ingest-progress-provider')).toHaveTextContent('Backblaze B2 Main');
    expect(screen.getByTestId('cancel-queue-btn')).toBeInTheDocument();
  });

  it('BulkIngestTabs renders both tabs', () => {
    renderWithProviders(<BulkIngestTabs activeTab="archive" onTabChange={noop} />);
    expect(screen.getByTestId('tab-archive')).toBeInTheDocument();
    expect(screen.getByTestId('tab-url')).toBeInTheDocument();
  });
});

describe('useBulkIngestModal hook', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('defaults to archive tab with archive description and switches tabs', async () => {
    const { result } = renderHook(
      () => useBulkIngestModal({ seriesId: 'series-1', seasons: mockSeasons, localEpisodes: mockLocalEpisodes }),
      { wrapper: createWrapper() }
    );
    expect(result.current.activeTab).toBe('archive');
    expect(result.current.effectiveStep).toBe(1);
    expect(result.current.description).toMatch(/archive URL/i);
    expect(result.current.isProcessingAny).toBe(false);

    act(() => {
      result.current.setActiveTab('url');
    });
    expect(result.current.activeTab).toBe('url');
    expect(result.current.description).toMatch(/multi-line/i);

    act(() => {
      result.current.resetOnClose(false);
    });
    await waitFor(() => {
      expect(result.current.activeTab).toBe('archive');
    });
  });
});
