import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useScrapeWorkerStore } from '@/modules/videos/internal/store/useScrapeWorkerStore';
import * as apiModule from '@/modules/videos/internal/api';

vi.mock('@/modules/videos/internal/api', async () => {
  const actual = await vi.importActual<typeof import('@/modules/videos/internal/api')>(
    '@/modules/videos/internal/api'
  );
  return {
    ...actual,
    previewScrape: vi.fn(),
  };
});

describe('useScrapeWorkerStore', () => {
  beforeEach(() => {
    useScrapeWorkerStore.getState().reset();
    useScrapeWorkerStore.setState({ isOpen: false });
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useScrapeWorkerStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.step).toBe(1);
    expect(state.sourceUrl).toBe('');
    expect(state.source).toBe('otakudesu');
    expect(state.html).toBe('');
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.previewData).toBeNull();
  });

  it('opens and closes dialog', () => {
    useScrapeWorkerStore.getState().openDialog();
    expect(useScrapeWorkerStore.getState().isOpen).toBe(true);

    useScrapeWorkerStore.getState().closeDialog();
    expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
  });

  it('updates form state fields', () => {
    useScrapeWorkerStore.getState().setSourceUrl('https://otakudesu.cloud/ep1');
    useScrapeWorkerStore.getState().setHtml('<html>test</html>');

    expect(useScrapeWorkerStore.getState().sourceUrl).toBe(
      'https://otakudesu.cloud/ep1'
    );
    expect(useScrapeWorkerStore.getState().html).toBe('<html>test</html>');
  });

  it('successfully submits preview and transitions to step 2', async () => {
    const mockPreviewData: apiModule.PreviewScrapeResult = {
      episode: {
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Test Episode 1',
        videoType: 'mp4',
        videoSources: [
          {
            type: 'direct',
            url: 'https://video.stream/ep1.mp4',
            label: 'Server 1',
          },
        ],
        metadata: { animePageUrl: 'https://otakudesu.cloud/anime/test' },
      },
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/test',
        source: 'otakudesu',
        title: 'Test Series',
        description: 'Series description',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      warnings: ['Failed to fetch episode duration'],
    };

    vi.mocked(apiModule.previewScrape).mockResolvedValueOnce(mockPreviewData);

    useScrapeWorkerStore.getState().setSourceUrl('https://otakudesu.cloud/ep1');
    useScrapeWorkerStore.getState().setHtml('<html>test</html>');

    const promise = useScrapeWorkerStore.getState().submitPreview();

    expect(useScrapeWorkerStore.getState().isLoading).toBe(true);

    const success = await promise;

    expect(success).toBe(true);
    expect(useScrapeWorkerStore.getState().isLoading).toBe(false);
    expect(useScrapeWorkerStore.getState().step).toBe(2);
    expect(useScrapeWorkerStore.getState().previewData).toEqual(mockPreviewData);
    expect(useScrapeWorkerStore.getState().error).toBeNull();
  });

  it('handles preview scrape error and stays on step 1', async () => {
    vi.mocked(apiModule.previewScrape).mockRejectedValueOnce(
      new Error('Invalid HTML payload')
    );

    useScrapeWorkerStore.getState().setSourceUrl('https://otakudesu.cloud/ep1');
    useScrapeWorkerStore.getState().setHtml('invalid');

    const success = await useScrapeWorkerStore.getState().submitPreview();

    expect(success).toBe(false);
    expect(useScrapeWorkerStore.getState().isLoading).toBe(false);
    expect(useScrapeWorkerStore.getState().step).toBe(1);
    expect(useScrapeWorkerStore.getState().previewData).toBeNull();
    expect(useScrapeWorkerStore.getState().error).toBe('Invalid HTML payload');
  });

  it('allows navigating back to step 1 from step 2', () => {
    useScrapeWorkerStore.getState().setStep(2);
    expect(useScrapeWorkerStore.getState().step).toBe(2);

    useScrapeWorkerStore.getState().backToStep1();
    expect(useScrapeWorkerStore.getState().step).toBe(1);
  });
});
