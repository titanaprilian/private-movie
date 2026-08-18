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
    previewScrapeSeries: vi.fn(),
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
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.previewData).toBeNull();
    expect(state.editablePreviewSeries).toBeNull();
    expect(state.editablePreviewEpisodes).toBeNull();
  });

  it('opens and closes dialog', () => {
    useScrapeWorkerStore.getState().openDialog();
    expect(useScrapeWorkerStore.getState().isOpen).toBe(true);

    useScrapeWorkerStore.getState().closeDialog();
    expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
  });

  it('updates form state fields', () => {
    useScrapeWorkerStore.getState().setSourceUrl('https://otakudesu.cloud/ep1');

    expect(useScrapeWorkerStore.getState().sourceUrl).toBe(
      'https://otakudesu.cloud/ep1'
    );
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

    const promise = useScrapeWorkerStore.getState().submitPreview();

    expect(useScrapeWorkerStore.getState().isLoading).toBe(true);

    const success = await promise;

    expect(success).toBe(true);
    expect(useScrapeWorkerStore.getState().isLoading).toBe(false);
    expect(useScrapeWorkerStore.getState().step).toBe(2);
    expect(useScrapeWorkerStore.getState().previewData).toEqual(mockPreviewData);
    expect(useScrapeWorkerStore.getState().editablePreviewSeries).toEqual(mockPreviewData.series);
    expect(useScrapeWorkerStore.getState().error).toBeNull();
  });

  it('handles preview scrape error and stays on step 1', async () => {
    vi.mocked(apiModule.previewScrape).mockRejectedValueOnce(
      new Error('Invalid HTML payload')
    );

    useScrapeWorkerStore.getState().setSourceUrl('https://otakudesu.cloud/ep1');

    const success = await useScrapeWorkerStore.getState().submitPreview();

    expect(success).toBe(false);
    expect(useScrapeWorkerStore.getState().isLoading).toBe(false);
    expect(useScrapeWorkerStore.getState().step).toBe(1);
    expect(useScrapeWorkerStore.getState().previewData).toBeNull();
    expect(useScrapeWorkerStore.getState().error).toBe('Invalid HTML payload');
  });

  it('calls previewScrapeSeries when sourceUrl matches a series URL signature (/anime/)', async () => {
    const mockSeriesData: apiModule.PreviewScrapeSeriesResult = {
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/grand-blue-s3-sub-indo/',
        source: 'otakudesu',
        title: 'Grand Blue Season 3',
        description: 'Diving club anime',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      episodes: [
        {
          title: 'Episode 1',
          url: 'https://otakudesu.cloud/episode/gb-ep-1',
          date: '10 Jan 2025',
        },
      ],
    };

    vi.mocked(apiModule.previewScrapeSeries).mockResolvedValueOnce(mockSeriesData);

    useScrapeWorkerStore
      .getState()
      .setSourceUrl('https://otakudesu.cloud/anime/grand-blue-s3-sub-indo/');

    const success = await useScrapeWorkerStore.getState().submitPreview();

    expect(success).toBe(true);
    expect(apiModule.previewScrapeSeries).toHaveBeenCalledWith({
      sourceUrl: 'https://otakudesu.cloud/anime/grand-blue-s3-sub-indo/',
      source: 'otakudesu',
    });
    expect(apiModule.previewScrape).not.toHaveBeenCalled();
    expect(useScrapeWorkerStore.getState().step).toBe(2);
    expect(useScrapeWorkerStore.getState().isBatch).toBe(true);
    expect(useScrapeWorkerStore.getState().seriesPreviewData).toEqual(mockSeriesData);
    expect(useScrapeWorkerStore.getState().editablePreviewSeries).toEqual(mockSeriesData.series);
    expect(useScrapeWorkerStore.getState().editablePreviewEpisodes).toEqual(mockSeriesData.episodes);
    expect(useScrapeWorkerStore.getState().previewData).toBeNull();
  });

  it('allows setting and updating editablePreviewEpisodes draft state', () => {
    useScrapeWorkerStore.getState().setEditablePreviewEpisodes([
      {
        title: 'Original Episode 1',
        url: 'https://otakudesu.cloud/episode/ep-1',
        date: '10 Jan 2025',
      },
      {
        title: 'Original Episode 2',
        url: 'https://otakudesu.cloud/episode/ep-2',
        date: '11 Jan 2025',
      },
    ]);

    expect(useScrapeWorkerStore.getState().editablePreviewEpisodes).toHaveLength(2);

    useScrapeWorkerStore.getState().updateEditablePreviewEpisode(0, {
      title: 'Custom Edited Title Ep 1',
      url: 'https://otakudesu.cloud/episode/ep-1-custom',
    });

    expect(useScrapeWorkerStore.getState().editablePreviewEpisodes?.[0]).toEqual({
      title: 'Custom Edited Title Ep 1',
      url: 'https://otakudesu.cloud/episode/ep-1-custom',
      date: '10 Jan 2025',
    });
  });

  it('allows setting and updating editablePreviewSeries draft state', () => {
    useScrapeWorkerStore.getState().setEditablePreviewSeries({
      sourceUrl: 'https://otakudesu.cloud/anime/test',
      source: 'otakudesu',
      title: 'Original Title',
      description: 'Original Description',
      posterUrl: 'https://otakudesu.cloud/poster.jpg',
    });

    expect(useScrapeWorkerStore.getState().editablePreviewSeries).toEqual({
      sourceUrl: 'https://otakudesu.cloud/anime/test',
      source: 'otakudesu',
      title: 'Original Title',
      description: 'Original Description',
      posterUrl: 'https://otakudesu.cloud/poster.jpg',
    });

    useScrapeWorkerStore.getState().updateEditablePreviewSeries({
      title: 'Edited Title',
      description: 'Edited Description',
    });

    expect(useScrapeWorkerStore.getState().editablePreviewSeries?.title).toBe(
      'Edited Title'
    );
    expect(
      useScrapeWorkerStore.getState().editablePreviewSeries?.description
    ).toBe('Edited Description');
    expect(
      useScrapeWorkerStore.getState().editablePreviewSeries?.posterUrl
    ).toBe('https://otakudesu.cloud/poster.jpg');
  });

  it('allows navigating back to step 1 from step 2', () => {
    useScrapeWorkerStore.getState().setStep(2);
    expect(useScrapeWorkerStore.getState().step).toBe(2);

    useScrapeWorkerStore.getState().backToStep1();
    expect(useScrapeWorkerStore.getState().step).toBe(1);
  });

  it('allows adding an empty episode draft row', () => {
    useScrapeWorkerStore.getState().setEditablePreviewEpisodes([
      {
        title: 'Episode 1',
        url: 'https://otakudesu.cloud/episode/ep-1',
        date: '10 Jan 2025',
      },
    ]);

    useScrapeWorkerStore.getState().addEditablePreviewEpisode();

    const episodes = useScrapeWorkerStore.getState().editablePreviewEpisodes;
    expect(episodes).toHaveLength(2);
    expect(episodes?.[1]).toEqual({
      title: '',
      url: '',
      date: null,
    });
  });

  it('allows setting an optional embedUrl on an episode draft row via updateEditablePreviewEpisode', () => {
    useScrapeWorkerStore.getState().setEditablePreviewEpisodes([
      {
        title: 'Episode 1',
        url: 'https://otakudesu.cloud/episode/ep-1',
        date: '10 Jan 2025',
      },
    ]);

    useScrapeWorkerStore.getState().updateEditablePreviewEpisode(0, {
      embedUrl: 'https://embed.com/ep1',
    });

    expect(useScrapeWorkerStore.getState().editablePreviewEpisodes?.[0]).toEqual({
      title: 'Episode 1',
      url: 'https://otakudesu.cloud/episode/ep-1',
      date: '10 Jan 2025',
      embedUrl: 'https://embed.com/ep1',
    });
  });

  it('allows clearing an embedUrl on an episode draft row', () => {
    useScrapeWorkerStore.getState().setEditablePreviewEpisodes([
      {
        title: 'Episode 1',
        url: 'https://otakudesu.cloud/episode/ep-1',
        date: '10 Jan 2025',
        embedUrl: 'https://embed.com/ep1',
      },
    ]);

    useScrapeWorkerStore.getState().updateEditablePreviewEpisode(0, {
      embedUrl: '',
    });

    expect(useScrapeWorkerStore.getState().editablePreviewEpisodes?.[0]).toEqual({
      title: 'Episode 1',
      url: 'https://otakudesu.cloud/episode/ep-1',
      date: '10 Jan 2025',
      embedUrl: '',
    });
  });

  it('allows deleting an episode draft row by index', () => {
    useScrapeWorkerStore.getState().setEditablePreviewEpisodes([
      {
        title: 'Episode 1',
        url: 'https://otakudesu.cloud/episode/ep-1',
        date: '10 Jan 2025',
      },
      {
        title: 'Episode 2',
        url: 'https://otakudesu.cloud/episode/ep-2',
        date: '11 Jan 2025',
      },
      {
        title: 'Episode 3',
        url: 'https://otakudesu.cloud/episode/ep-3',
        date: '12 Jan 2025',
      },
    ]);

    useScrapeWorkerStore.getState().deleteEditablePreviewEpisode(1);

    const episodes = useScrapeWorkerStore.getState().editablePreviewEpisodes;
    expect(episodes).toHaveLength(2);
    expect(episodes?.[0].title).toBe('Episode 1');
    expect(episodes?.[1].title).toBe('Episode 3');
  });
});
