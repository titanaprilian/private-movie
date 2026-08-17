import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddMediaDialog } from '@/modules/videos/internal/AddMediaDialog';
import { useScrapeWorkerStore } from '@/modules/videos/internal/store/useScrapeWorkerStore';
import * as apiModule from '@/modules/videos/internal/api';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/modules/videos/internal/api', async () => {
  const actual = await vi.importActual<typeof import('@/modules/videos/internal/api')>(
    '@/modules/videos/internal/api'
  );
  return {
    ...actual,
    previewScrape: vi.fn(),
    saveMedia: vi.fn(),
  };
});

const mockMultiMirrorResult: apiModule.PreviewScrapeResult = {
  episode: {
    sourceUrl: 'https://otakudesu.cloud/ep1',
    source: 'otakudesu',
    title: 'Multi-Mirror Episode',
    videoType: 'mp4',
    videoSources: [
      {
        type: 'embed',
        url: 'https://odstream.com/embed/1',
        label: 'odstream',
        quality: '720p',
      },
      {
        type: 'embed',
        url: 'https://filedon.com/embed/2',
        label: 'filedon',
        quality: '720p',
      },
      {
        type: 'embed',
        url: 'https://vidhide.com/embed/3',
        label: 'vidhide',
        quality: '720p',
      },
      {
        type: 'embed',
        url: 'https://mega.com/embed/4',
        label: 'mega',
        quality: '720p',
      },
    ],
    metadata: {},
  },
  series: {
    sourceUrl: 'https://otakudesu.cloud/series/1',
    source: 'otakudesu',
    title: 'Test Series',
    description: 'Series desc',
    posterUrl: 'https://otakudesu.cloud/poster.jpg',
  },
  warnings: [],
};

describe('AddMediaDialog component — multi-mirror scenarios', () => {
  beforeEach(() => {
    useScrapeWorkerStore.getState().reset();
    useScrapeWorkerStore.setState({ isOpen: false });
    vi.clearAllMocks();
  });

  it('renders all 4 mirror sources in Step 2 preview', async () => {
    vi.mocked(apiModule.previewScrape).mockResolvedValueOnce(mockMultiMirrorResult);

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/ep1');
    await user.click(screen.getByRole('button', { name: /Preview Scrape/i }));

    expect(await screen.findByText('Multi-Mirror Episode')).toBeInTheDocument();
    expect(screen.getByText('Video Sources (4)')).toBeInTheDocument();
    expect(screen.getByText('odstream')).toBeInTheDocument();
    expect(screen.getByText('filedon')).toBeInTheDocument();
    expect(screen.getByText('vidhide')).toBeInTheDocument();
    expect(screen.getByText('mega')).toBeInTheDocument();
  });

  it('disables the scrape button during loading', async () => {
    let resolvePromise!: (value: apiModule.PreviewScrapeResult) => void;
    const promise = new Promise<apiModule.PreviewScrapeResult>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(apiModule.previewScrape).mockReturnValueOnce(promise);

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/ep1');

    const btn = screen.getByRole('button', { name: /Preview Scrape/i });
    await user.click(btn);

    // Wait for loading state to appear
    await waitFor(() => {
      expect(screen.getByText('Resolving mirrors...')).toBeInTheDocument();
    }, { timeout: 3000 });

    resolvePromise(mockMultiMirrorResult);
  });

  it('displays partial failure warning when some mirrors fail to resolve', async () => {
    const partialResult: apiModule.PreviewScrapeResult = {
      episode: {
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Partial Mirror Episode',
        videoType: 'mp4',
        videoSources: [
          { type: 'embed' as const, url: 'https://odstream.com/embed/1', label: 'odstream', quality: '720p' },
          { type: 'embed' as const, url: 'https://filedon.com/embed/2', label: 'filedon', quality: '720p' },
        ],
        metadata: {},
      },
      series: {
        sourceUrl: 'https://otakudesu.cloud/series/1',
        source: 'otakudesu',
        title: 'Test Series',
        description: 'Series desc',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      warnings: ['2 of 4 mirrors resolved successfully'],
    };

    let resolvePromise!: (value: apiModule.PreviewScrapeResult) => void;
    const promise = new Promise<apiModule.PreviewScrapeResult>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(apiModule.previewScrape).mockReturnValueOnce(promise);

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/ep1');

    const btn = screen.getByRole('button', { name: /Preview Scrape/i });
    await user.click(btn);

    // Resolve the mock promise, then wait for UI updates
    resolvePromise!(partialResult);
    
    await waitFor(() => {
      expect(screen.queryByText('Parsed Test Episode')).not.toBeInTheDocument();
    }, { timeout: 100 });
    
    await waitFor(() => {
      expect(screen.getByText('Partial Mirror Episode')).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByText('2 of 4 mirrors resolved successfully')).toBeInTheDocument();
  });
});
