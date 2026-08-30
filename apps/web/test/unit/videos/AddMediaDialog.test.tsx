import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddMediaDialog } from '@/modules/videos/internal/AddMediaDialog';
import { useScrapeWorkerStore } from '@/modules/videos/internal/store/useScrapeWorkerStore';
import * as apiModule from '@/modules/videos/internal/api';
import { toast } from 'sonner';

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
    previewScrapeSeries: vi.fn(),
    saveMedia: vi.fn(),
    importTmdb: vi.fn(),
    fetchSeriesTmdbPreview: vi.fn(),
  };
});

describe('AddMediaDialog component', () => {
  beforeEach(() => {
    useScrapeWorkerStore.getState().reset();
    useScrapeWorkerStore.setState({ isOpen: false });
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<AddMediaDialog />);
    expect(screen.queryByText('Add Media Wizard')).not.toBeInTheDocument();
  });

  it('renders Step 1 form fields when open', () => {
    useScrapeWorkerStore.getState().openDialog();
    renderWithProviders(<AddMediaDialog />);

    expect(screen.getByText('Add Media Wizard')).toBeInTheDocument();
    expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Source URL/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Preview Scrape/i })
    ).toBeInTheDocument();
  });

  it('dynamically switches input fields when Source Provider is changed to tmdb', async () => {
    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    expect(screen.getByLabelText(/Source URL/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/TMDB ID/i)).not.toBeInTheDocument();

    const providerSelect = screen.getByLabelText(/Source Provider/i);
    await user.selectOptions(providerSelect, 'tmdb');

    expect(screen.queryByLabelText(/Source URL/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/TMDB ID/i)).toBeInTheDocument();
  });

  it('previews TMDB metadata in Step 2 and invokes importTmdb mutation on Save', async () => {
    const mockTmdbPreview: apiModule.TmdbPreviewResult = {
      title: 'Game of Thrones',
      overview: 'Seven noble families fight for control of the mythical land of Westeros.',
      posterUrl: 'https://image.tmdb.org/t/p/w500/got.jpg',
    };

    const mockImportedSeries: apiModule.SeriesDetails = {
      id: 'series-got-1',
      sourceUrl: 'https://themoviedb.org/tv/1399',
      source: 'tmdb',
      title: 'Game of Thrones',
      description: 'Seven noble families fight...',
      posterUrl: 'https://image.tmdb.org/t/p/w500/got.jpg',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [],
    };

    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(mockTmdbPreview);
    vi.mocked(apiModule.importTmdb).mockResolvedValueOnce(mockImportedSeries);

    useScrapeWorkerStore.getState().openDialog();
    const { user, queryClient } = renderWithProviders(<AddMediaDialog />);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.selectOptions(screen.getByLabelText(/Source Provider/i), 'tmdb');
    await user.selectOptions(screen.getByLabelText(/Type/i), 'tv');
    await user.type(screen.getByLabelText(/TMDB ID/i), '1399');

    const previewBtn = screen.getByRole('button', { name: /Preview Scrape/i });
    await user.click(previewBtn);

    expect(await screen.findByText('TMDB Snapshot Overview')).toBeInTheDocument();
    expect(screen.getByText('Game of Thrones')).toBeInTheDocument();
    expect(screen.getByText(/Seven noble families fight for control/i)).toBeInTheDocument();
    expect(screen.getByText(/tv • ID #1399/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(apiModule.importTmdb).toHaveBeenCalledWith(
        {
          type: 'tv',
          tmdbId: 1399,
        },
        expect.anything()
      );
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['episodes'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(toast.success).toHaveBeenCalledWith('Media saved successfully');
      expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
    });
  });

  it('simulates Step 1 to Step 2 transition with preview card and warning banner', async () => {
    const mockResult: apiModule.PreviewScrapeResult = {
      episode: {
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Parsed Test Episode',
        videoType: 'mp4',
        videoSources: [
          {
            type: 'direct',
            url: 'https://stream.com/video.mp4',
            label: 'Server 1',
          },
        ],
        metadata: {
          resolution: '1080p',
          duration: '24m',
        },
      },
      series: {
        sourceUrl: 'https://otakudesu.cloud/series/1',
        source: 'otakudesu',
        title: 'Parsed Test Series',
        description: 'Parsed series description',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      warnings: ['Series details missing episode count'],
    };

    vi.mocked(apiModule.previewScrape).mockResolvedValueOnce(mockResult);

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    const urlInput = screen.getByLabelText(/Source URL/i);

    await user.type(urlInput, 'https://otakudesu.cloud/ep1');

    const submitBtn = screen.getByRole('button', { name: /Preview Scrape/i });
    await user.click(submitBtn);

    expect(await screen.findByText('Parsed Test Episode')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Parsed Test Series')).toBeInTheDocument();
    expect(
      screen.getByText('Series details missing episode count')
    ).toBeInTheDocument();
    expect(screen.getByText(/Step 2/i)).toBeInTheDocument();
  });

  it('renders multiple video sources in Step 2 preview', async () => {
    const mockResult: apiModule.PreviewScrapeResult = {
      episode: {
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Multi-Source Episode',
        videoType: 'mp4',
        videoSources: [
          {
            type: 'direct',
            url: 'https://stream.com/direct1.mp4',
            label: 'Direct Server 1',
            quality: '1080p',
          },
          {
            type: 'embed',
            url: 'https://embed.com/server2',
            label: 'Embed Server 2',
          },
        ],
        metadata: {},
      },
      series: null,
      warnings: [],
    };

    vi.mocked(apiModule.previewScrape).mockResolvedValueOnce(mockResult);

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/ep1');
    await user.click(screen.getByRole('button', { name: /Preview Scrape/i }));

    expect(await screen.findByText('Multi-Source Episode')).toBeInTheDocument();
    expect(screen.getByText('Direct Server 1')).toBeInTheDocument();
    expect(screen.getByText('Embed Server 2')).toBeInTheDocument();
    expect(screen.getByText('https://stream.com/direct1.mp4')).toBeInTheDocument();
    expect(screen.getByText('https://embed.com/server2')).toBeInTheDocument();
  });

  it('triggers saveMedia mutation on hitting Save in Step 2, invalidates cache queries, notifies toast, and resets wizard state', async () => {
    const mockPreviewResult: apiModule.PreviewScrapeResult = {
      episode: {
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Parsed Test Episode',
        videoType: 'mp4',
        videoSources: [
          {
            type: 'direct',
            url: 'https://stream.com/video.mp4',
            label: 'Server 1',
          },
        ],
        metadata: {
          resolution: '1080p',
        },
      },
      series: {
        sourceUrl: 'https://otakudesu.cloud/series/1',
        source: 'otakudesu',
        title: 'Parsed Test Series',
        description: 'Parsed series description',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      warnings: [],
    };

    const mockSavedResult: apiModule.SaveMediaResult = {
      episode: {
        id: 'ep-1',
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Parsed Test Episode',
        videoType: 'mp4',
        videoSources: [
          {
            id: 'vs-1',
            type: 'direct',
            url: 'https://stream.com/video.mp4',
            label: 'Server 1',
          },
        ],
        createdAt: '2025-01-10T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
      },
      series: null,
    };

    vi.mocked(apiModule.previewScrape).mockResolvedValueOnce(mockPreviewResult);
    vi.mocked(apiModule.saveMedia).mockResolvedValueOnce(mockSavedResult);

    useScrapeWorkerStore.getState().openDialog();
    const { user, queryClient } = renderWithProviders(<AddMediaDialog />);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const urlInput = screen.getByLabelText(/Source URL/i);

    await user.type(urlInput, 'https://otakudesu.cloud/ep1');

    const previewBtn = screen.getByRole('button', { name: /Preview Scrape/i });
    await user.click(previewBtn);

    expect(await screen.findByText('Parsed Test Episode')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(apiModule.saveMedia).toHaveBeenCalledWith(
        {
          episode: mockPreviewResult.episode,
          series: mockPreviewResult.series,
        },
        expect.anything()
      );
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['episodes'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(toast.success).toHaveBeenCalled();
      expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
    });
  });

  it('allows editing episode title, date, and URL inputs in Step 2 batch preview, preserving manual edits over scraped values during save', async () => {
    const mockSeriesPreviewResult: apiModule.PreviewScrapeSeriesResult = {
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/grand-blue-s3/',
        source: 'otakudesu',
        title: 'Grand Blue Season 3',
        description: 'Diving comedy series',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      episodes: [
        {
          title: 'Scraped Ep 1 Title',
          url: 'https://otakudesu.cloud/episode/gb-ep1-orig',
          date: '10 Jan 2025',
        },
      ],
    };

    vi.mocked(apiModule.previewScrapeSeries).mockResolvedValueOnce(mockSeriesPreviewResult);

    vi.mocked(apiModule.previewScrape).mockImplementation(async (params) => {
      return {
        episode: {
          sourceUrl: params.sourceUrl,
          source: params.source,
          title: 'Scraped Ep 1 Secondary Title',
          videoType: null,
          metadata: { publishedDate: 'Scraped Date' },
          videoSources: [],
        },
        series: null,
        warnings: [],
      };
    });

    vi.mocked(apiModule.saveMedia).mockResolvedValue({
      episode: {
        id: 'ep-saved',
        sourceUrl: '',
        source: 'otakudesu',
        title: '',
        videoSources: [],
        createdAt: '',
        updatedAt: '',
      },
      series: null,
    });

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/anime/grand-blue-s3/');
    await user.click(screen.getByRole('button', { name: /Preview Scrape/i }));

    const epTitleInput = await screen.findByLabelText(/Episode Title #1/i);
    const epDateInput = screen.getByLabelText(/Episode Date #1/i);
    const epUrlInput = screen.getByLabelText(/Episode URL #1/i);

    expect(epTitleInput).toHaveValue('Scraped Ep 1 Title');
    expect(epDateInput).toHaveValue('10 Jan 2025');
    expect(epUrlInput).toHaveValue('https://otakudesu.cloud/episode/gb-ep1-orig');

    await user.clear(epTitleInput);
    await user.type(epTitleInput, 'Edited Ep 1 Title');

    await user.clear(epDateInput);
    await user.type(epDateInput, '12 Jan 2025');

    await user.clear(epUrlInput);
    await user.type(epUrlInput, 'https://otakudesu.cloud/episode/gb-ep1-edited');

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(apiModule.previewScrape).toHaveBeenCalledWith({
        sourceUrl: 'https://otakudesu.cloud/episode/gb-ep1-edited',
        source: 'otakudesu',
      });
      expect(apiModule.saveMedia).toHaveBeenCalledWith(
        {
          episode: {
            sourceUrl: 'https://otakudesu.cloud/episode/gb-ep1-edited',
            source: 'otakudesu',
            title: 'Edited Ep 1 Title',
            videoType: null,
            metadata: { publishedDate: '12 Jan 2025' },
            videoSources: [],
          },
          series: mockSeriesPreviewResult.series,
        }
      );
    });
  });

  it('allows editing series inputs in Step 2 and passes overridden series metadata to saveMedia on Save', async () => {
    const mockPreviewResult: apiModule.PreviewScrapeResult = {
      episode: {
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Parsed Test Episode',
        videoType: 'mp4',
        videoSources: [],
        metadata: {},
      },
      series: {
        sourceUrl: 'https://otakudesu.cloud/series/1',
        source: 'otakudesu',
        title: 'Original Series Title',
        description: 'Original description',
        posterUrl: 'https://otakudesu.cloud/original.jpg',
      },
      warnings: [],
    };

    vi.mocked(apiModule.previewScrape).mockResolvedValueOnce(mockPreviewResult);
    vi.mocked(apiModule.saveMedia).mockResolvedValueOnce({
      episode: {
        id: 'ep-1',
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Parsed Test Episode',
        videoSources: [],
        createdAt: '2025-01-10T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
      },
      series: null,
    });

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/ep1');
    await user.click(screen.getByRole('button', { name: /Preview Scrape/i }));

    const titleInput = await screen.findByLabelText(/Series Title/i);
    const descInput = screen.getByLabelText(/Description/i);
    const posterInput = screen.getByLabelText(/Poster URL/i);

    expect(titleInput).toHaveValue('Original Series Title');
    expect(descInput).toHaveValue('Original description');
    expect(posterInput).toHaveValue('https://otakudesu.cloud/original.jpg');

    await user.clear(titleInput);
    await user.type(titleInput, 'Custom Overridden Title');

    await user.clear(descInput);
    await user.type(descInput, 'Custom Overridden Description');

    await user.clear(posterInput);
    await user.type(posterInput, 'https://otakudesu.cloud/custom-poster.jpg');

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(apiModule.saveMedia).toHaveBeenCalledWith(
        {
          episode: mockPreviewResult.episode,
          series: {
            sourceUrl: 'https://otakudesu.cloud/series/1',
            source: 'otakudesu',
            title: 'Custom Overridden Title',
            description: 'Custom Overridden Description',
            posterUrl: 'https://otakudesu.cloud/custom-poster.jpg',
          },
        },
        expect.anything()
      );
    });
  });

  it('renders batch series preview in Step 2 and iteratively calls saveMedia for each episode when Save is clicked', async () => {
    const mockSeriesPreviewResult: apiModule.PreviewScrapeSeriesResult = {
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/grand-blue-s3/',
        source: 'otakudesu',
        title: 'Grand Blue Season 3',
        description: 'Diving comedy series',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      episodes: [
        {
          title: 'Grand Blue S3 Episode 1',
          url: 'https://otakudesu.cloud/episode/gb-s3-ep1',
          date: '10 Jan 2025',
        },
        {
          title: 'Grand Blue S3 Episode 2',
          url: 'https://otakudesu.cloud/episode/gb-s3-ep2',
          date: '17 Jan 2025',
        },
      ],
    };

    vi.mocked(apiModule.previewScrapeSeries).mockResolvedValueOnce(mockSeriesPreviewResult);
    
    // Mock previewScrape for the individual episodes inside the loop
    vi.mocked(apiModule.previewScrape).mockImplementation(async (params) => {
      return {
        episode: {
          sourceUrl: params.sourceUrl,
          source: params.source,
          title: params.sourceUrl.includes('ep1') ? 'Grand Blue S3 Episode 1' : 'Grand Blue S3 Episode 2',
          videoType: null,
          metadata: params.sourceUrl.includes('ep1') ? { publishedDate: '10 Jan 2025' } : { publishedDate: '17 Jan 2025' },
          videoSources: [],
        },
        series: null,
        warnings: [],
      };
    });

    vi.mocked(apiModule.saveMedia).mockResolvedValue({
      episode: {
        id: 'ep-saved',
        sourceUrl: '',
        source: 'otakudesu',
        title: '',
        videoSources: [],
        createdAt: '',
        updatedAt: '',
      },
      series: null,
    });

    useScrapeWorkerStore.getState().openDialog();
    const { user, queryClient } = renderWithProviders(<AddMediaDialog />);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const urlInput = screen.getByLabelText(/Source URL/i);
    await user.type(urlInput, 'https://otakudesu.cloud/anime/grand-blue-s3/');

    const previewBtn = screen.getByRole('button', { name: /Preview Scrape/i });
    await user.click(previewBtn);

    expect(await screen.findByDisplayValue('Grand Blue Season 3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Grand Blue S3 Episode 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Grand Blue S3 Episode 2')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(apiModule.saveMedia).toHaveBeenCalledTimes(2);
      expect(apiModule.saveMedia).toHaveBeenNthCalledWith(
        1,
        {
          episode: {
            sourceUrl: 'https://otakudesu.cloud/episode/gb-s3-ep1',
            source: 'otakudesu',
            title: 'Grand Blue S3 Episode 1',
            videoType: null,
            metadata: { publishedDate: '10 Jan 2025' },
            videoSources: [],
          },
          series: mockSeriesPreviewResult.series,
        }
      );
      expect(apiModule.saveMedia).toHaveBeenNthCalledWith(
        2,
        {
          episode: {
            sourceUrl: 'https://otakudesu.cloud/episode/gb-s3-ep2',
            source: 'otakudesu',
            title: 'Grand Blue S3 Episode 2',
            videoType: null,
            metadata: { publishedDate: '17 Jan 2025' },
            videoSources: [],
          },
          series: mockSeriesPreviewResult.series,
        }
      );
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['episodes'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(toast.success).toHaveBeenCalled();
      expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
    });
  });

  it('pauses batch saving when previewScrape returns EPISODE_MISSING_FIELDS, renders missing fields inputs, bypasses broken page on continue, and resumes remaining batch', async () => {
    const mockSeriesPreviewResult: apiModule.PreviewScrapeSeriesResult = {
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/test-series/',
        source: 'otakudesu',
        title: 'Test Series Batch',
        description: 'Series description',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      episodes: [
        {
          title: 'Episode 1',
          url: 'https://otakudesu.cloud/episode/ep1',
          date: '10 Jan 2025',
        },
        {
          title: 'Episode 2',
          url: 'https://otakudesu.cloud/episode/ep2',
          date: '17 Jan 2025',
        },
        {
          title: 'Episode 3',
          url: 'https://otakudesu.cloud/episode/ep3',
          date: '24 Jan 2025',
        },
      ],
    };

    vi.mocked(apiModule.previewScrapeSeries).mockResolvedValueOnce(mockSeriesPreviewResult);

    vi.mocked(apiModule.previewScrape).mockImplementation(async (params) => {
      if (params.sourceUrl.includes('ep1')) {
        return {
          episode: {
            sourceUrl: params.sourceUrl,
            source: params.source,
            title: 'Episode 1',
            videoType: null,
            metadata: { publishedDate: '10 Jan 2025' },
            videoSources: [],
          },
          series: null,
          warnings: [],
        };
      }
      if (params.sourceUrl.includes('ep2')) {
        const err = new Error('Missing required fields') as Error & {
          code: string;
          missingFields: string[];
        };
        err.code = 'EPISODE_MISSING_FIELDS';
        err.missingFields = ['title', 'embedUrl'];
        throw err;
      }
      return {
        episode: {
          sourceUrl: params.sourceUrl,
          source: params.source,
          title: 'Episode 3',
          videoType: null,
          metadata: { publishedDate: '24 Jan 2025' },
          videoSources: [],
        },
        series: null,
        warnings: [],
      };
    });

    vi.mocked(apiModule.saveMedia).mockResolvedValue({
      episode: {
        id: 'ep-saved',
        sourceUrl: '',
        source: 'otakudesu',
        title: '',
        videoSources: [],
        createdAt: '',
        updatedAt: '',
      },
      series: null,
    });

    useScrapeWorkerStore.getState().openDialog();
    const { user, queryClient } = renderWithProviders(<AddMediaDialog />);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const urlInput = screen.getByLabelText(/Source URL/i);
    await user.type(urlInput, 'https://otakudesu.cloud/anime/test-series/');

    const previewBtn = screen.getByRole('button', { name: /Preview Scrape/i });
    await user.click(previewBtn);

    expect(await screen.findByDisplayValue('Test Series Batch')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await user.click(saveBtn);

    expect(await screen.findByText(/Missing Required Fields \(Episode #2\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText('title')).toBeInTheDocument();
    expect(screen.getByLabelText('embedUrl')).toBeInTheDocument();

    expect(apiModule.saveMedia).toHaveBeenCalledTimes(1);
    expect(apiModule.saveMedia).toHaveBeenNthCalledWith(1, {
      episode: {
        sourceUrl: 'https://otakudesu.cloud/episode/ep1',
        source: 'otakudesu',
        title: 'Episode 1',
        videoType: null,
        metadata: { publishedDate: '10 Jan 2025' },
        videoSources: [],
      },
      series: mockSeriesPreviewResult.series,
    });

    await user.type(screen.getByLabelText('title'), 'Episode 2 Manual Title');
    await user.type(screen.getByLabelText('embedUrl'), 'https://embed.com/ep2');

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    await user.click(continueBtn);

    await waitFor(() => {
      expect(apiModule.saveMedia).toHaveBeenCalledTimes(3);
      expect(apiModule.saveMedia).toHaveBeenNthCalledWith(2, {
        episode: {
          sourceUrl: 'https://otakudesu.cloud/episode/ep2',
          source: 'otakudesu',
          title: 'Episode 2 Manual Title',
          videoType: null,
          videoSources: [
            {
              type: 'embed',
              url: 'https://embed.com/ep2',
              label: 'Manual',
            },
          ],
          metadata: { publishedDate: '17 Jan 2025' },
        },
        series: mockSeriesPreviewResult.series,
      });
      expect(apiModule.saveMedia).toHaveBeenNthCalledWith(3, {
        episode: {
          sourceUrl: 'https://otakudesu.cloud/episode/ep3',
          source: 'otakudesu',
          title: 'Episode 3',
          videoType: null,
          metadata: { publishedDate: '24 Jan 2025' },
          videoSources: [],
        },
        series: mockSeriesPreviewResult.series,
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['episodes'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(toast.success).toHaveBeenCalled();
      expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
    });
  });

  it('allows adding an empty episode row via "+ Add Episode" button and deleting an episode row via Delete button in Step 2 batch preview', async () => {
    const mockSeriesPreviewResult: apiModule.PreviewScrapeSeriesResult = {
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/test-series/',
        source: 'otakudesu',
        title: 'Test Series',
        description: 'Description',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      episodes: [
        {
          title: 'Episode 1',
          url: 'https://otakudesu.cloud/episode/ep1',
          date: '10 Jan 2025',
        },
        {
          title: 'Episode 2',
          url: 'https://otakudesu.cloud/episode/ep2',
          date: '17 Jan 2025',
        },
      ],
    };

    vi.mocked(apiModule.previewScrapeSeries).mockResolvedValueOnce(mockSeriesPreviewResult);

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/anime/test-series/');
    await user.click(screen.getByRole('button', { name: /Preview Scrape/i }));

    expect(await screen.findByDisplayValue('Episode 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Episode 2')).toBeInTheDocument();

    // Click "+ Add Episode"
    const addBtn = screen.getByRole('button', { name: /\+ Add Episode/i });
    await user.click(addBtn);

    // Episode 3 input should be created
    expect(screen.getByLabelText(/Episode Title #3/i)).toBeInTheDocument();

    // Delete Episode 1 (index 0)
    const deleteBtns = screen.getAllByRole('button', { name: /Delete episode/i });
    await user.click(deleteBtns[0]);

    // Episode 1 should be gone, remaining rows should be Episode 2 and the empty added row
    expect(screen.queryByDisplayValue('Episode 1')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Episode 2')).toBeInTheDocument();
  });

  it('does not process deleted rows during batch save interval', async () => {
    const mockSeriesPreviewResult: apiModule.PreviewScrapeSeriesResult = {
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/test-series/',
        source: 'otakudesu',
        title: 'Test Series Batch',
        description: 'Description',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      episodes: [
        {
          title: 'Episode 1',
          url: 'https://otakudesu.cloud/episode/ep1',
          date: '10 Jan 2025',
        },
        {
          title: 'Episode 2',
          url: 'https://otakudesu.cloud/episode/ep2',
          date: '17 Jan 2025',
        },
      ],
    };

    vi.mocked(apiModule.previewScrapeSeries).mockResolvedValueOnce(mockSeriesPreviewResult);

    vi.mocked(apiModule.previewScrape).mockImplementation(async (params) => {
      return {
        episode: {
          sourceUrl: params.sourceUrl,
          source: params.source,
          title: 'Episode 2',
          videoType: null,
          metadata: { publishedDate: '17 Jan 2025' },
          videoSources: [],
        },
        series: null,
        warnings: [],
      };
    });

    vi.mocked(apiModule.saveMedia).mockResolvedValue({
      episode: {
        id: 'ep-saved',
        sourceUrl: '',
        source: 'otakudesu',
        title: '',
        videoSources: [],
        createdAt: '',
        updatedAt: '',
      },
      series: null,
    });

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/anime/test-series/');
    await user.click(screen.getByRole('button', { name: /Preview Scrape/i }));

    expect(await screen.findByDisplayValue('Episode 1')).toBeInTheDocument();

    // Delete Episode 1 (index 0)
    const deleteBtns = screen.getAllByRole('button', { name: /Delete episode/i });
    await user.click(deleteBtns[0]);

    // Save batch
    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(apiModule.saveMedia).toHaveBeenCalledTimes(1);
      expect(apiModule.saveMedia).toHaveBeenCalledWith({
        episode: {
          sourceUrl: 'https://otakudesu.cloud/episode/ep2',
          source: 'otakudesu',
          title: 'Episode 2',
          videoType: null,
          metadata: { publishedDate: '17 Jan 2025' },
          videoSources: [],
        },
        series: mockSeriesPreviewResult.series,
      });
    });
  });

  it('renders an optional Embed URL input for each episode row in Step 2 batch preview', async () => {
    const mockSeriesPreviewResult: apiModule.PreviewScrapeSeriesResult = {
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/test-series/',
        source: 'otakudesu',
        title: 'Test Series',
        description: 'Description',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      episodes: [
        {
          title: 'Episode 1',
          url: 'https://otakudesu.cloud/episode/ep1',
          date: '10 Jan 2025',
        },
        {
          title: 'Episode 2',
          url: 'https://otakudesu.cloud/episode/ep2',
          date: '17 Jan 2025',
        },
      ],
    };

    vi.mocked(apiModule.previewScrapeSeries).mockResolvedValueOnce(mockSeriesPreviewResult);

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/anime/test-series/');
    await user.click(screen.getByRole('button', { name: /Preview Scrape/i }));

    expect(await screen.findByDisplayValue('Episode 1')).toBeInTheDocument();
    expect(screen.getByLabelText(/Embed URL #1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Embed URL #2/i)).toBeInTheDocument();
  });

  it('bypasses individual scrape for episodes with a manual Embed URL and passes a matching payload to saveMedia', async () => {
    const mockSeriesPreviewResult: apiModule.PreviewScrapeSeriesResult = {
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/grand-blue-s3/',
        source: 'otakudesu',
        title: 'Grand Blue Season 3',
        description: 'Diving comedy series',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      episodes: [
        {
          title: 'Grand Blue S3 Episode 1',
          url: 'https://otakudesu.cloud/episode/gb-s3-ep1',
          date: '10 Jan 2025',
        },
        {
          title: 'Grand Blue S3 Episode 2',
          url: 'https://otakudesu.cloud/episode/gb-s3-ep2',
          date: '17 Jan 2025',
        },
      ],
    };

    vi.mocked(apiModule.previewScrapeSeries).mockResolvedValueOnce(mockSeriesPreviewResult);

    vi.mocked(apiModule.previewScrape).mockImplementation(async (params) => {
      return {
        episode: {
          sourceUrl: params.sourceUrl,
          source: params.source,
          title: 'Grand Blue S3 Episode 2',
          videoType: null,
          metadata: { publishedDate: '17 Jan 2025' },
          videoSources: [],
        },
        series: null,
        warnings: [],
      };
    });

    vi.mocked(apiModule.saveMedia).mockResolvedValue({
      episode: {
        id: 'ep-saved',
        sourceUrl: '',
        source: 'otakudesu',
        title: '',
        videoSources: [],
        createdAt: '',
        updatedAt: '',
      },
      series: null,
    });

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/anime/grand-blue-s3/');
    await user.click(screen.getByRole('button', { name: /Preview Scrape/i }));

    expect(await screen.findByDisplayValue('Grand Blue S3 Episode 1')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/Embed URL #1/i),
      'https://embed.com/gb-s3-ep1'
    );

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(apiModule.previewScrape).toHaveBeenCalledTimes(1);
      expect(apiModule.previewScrape).toHaveBeenCalledWith({
        sourceUrl: 'https://otakudesu.cloud/episode/gb-s3-ep2',
        source: 'otakudesu',
      });
      expect(apiModule.previewScrape).not.toHaveBeenCalledWith({
        sourceUrl: 'https://otakudesu.cloud/episode/gb-s3-ep1',
        source: 'otakudesu',
      });
      expect(apiModule.saveMedia).toHaveBeenCalledTimes(2);
      expect(apiModule.saveMedia).toHaveBeenNthCalledWith(
        1,
        {
          episode: {
            sourceUrl: 'https://otakudesu.cloud/episode/gb-s3-ep1',
            source: 'otakudesu',
            title: 'Grand Blue S3 Episode 1',
            videoType: null,
            videoSources: [
              {
                type: 'embed',
                url: 'https://embed.com/gb-s3-ep1',
                label: 'Manual',
              },
            ],
            metadata: { publishedDate: '10 Jan 2025' },
          },
          series: mockSeriesPreviewResult.series,
        }
      );
      expect(apiModule.saveMedia).toHaveBeenNthCalledWith(
        2,
        {
          episode: {
            sourceUrl: 'https://otakudesu.cloud/episode/gb-s3-ep2',
            source: 'otakudesu',
            title: 'Grand Blue S3 Episode 2',
            videoType: null,
            metadata: { publishedDate: '17 Jan 2025' },
            videoSources: [],
          },
          series: mockSeriesPreviewResult.series,
        }
      );
    });
  });

  it('renders drag handles for episode reordering and wraps grid in droppable container', async () => {
    const mockSeriesPreviewResult: apiModule.PreviewScrapeSeriesResult = {
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/test-series/',
        source: 'otakudesu',
        title: 'Test Series',
        description: 'Description',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      episodes: [
        {
          title: 'Episode 1',
          url: 'https://otakudesu.cloud/episode/ep1',
          date: '10 Jan 2025',
        },
        {
          title: 'Episode 2',
          url: 'https://otakudesu.cloud/episode/ep2',
          date: '17 Jan 2025',
        },
      ],
    };

    vi.mocked(apiModule.previewScrapeSeries).mockResolvedValueOnce(mockSeriesPreviewResult);

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/anime/test-series/');
    await user.click(screen.getByRole('button', { name: /Preview Scrape/i }));

    expect(await screen.findByDisplayValue('Episode 1')).toBeInTheDocument();
    expect(screen.getByLabelText(/Drag handle for episode #1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Drag handle for episode #2/i)).toBeInTheDocument();
  });

  it('reordering episode draft sequence reflects immediately on UI and saves batch in the new order', async () => {
    const mockSeriesPreviewResult: apiModule.PreviewScrapeSeriesResult = {
      series: {
        sourceUrl: 'https://otakudesu.cloud/anime/test-series/',
        source: 'otakudesu',
        title: 'Test Series Batch',
        description: 'Description',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
      },
      episodes: [
        {
          title: 'Episode 1 Original First',
          url: 'https://otakudesu.cloud/episode/ep1',
          date: '10 Jan 2025',
        },
        {
          title: 'Episode 2 Original Second',
          url: 'https://otakudesu.cloud/episode/ep2',
          date: '17 Jan 2025',
        },
      ],
    };

    vi.mocked(apiModule.previewScrapeSeries).mockResolvedValueOnce(mockSeriesPreviewResult);

    vi.mocked(apiModule.previewScrape).mockImplementation(async (params) => {
      const isEp1 = params.sourceUrl.includes('ep1');
      return {
        episode: {
          sourceUrl: params.sourceUrl,
          source: params.source,
          title: isEp1 ? 'Episode 1 Original First' : 'Episode 2 Original Second',
          videoType: null,
          metadata: isEp1 ? { publishedDate: '10 Jan 2025' } : { publishedDate: '17 Jan 2025' },
          videoSources: [],
        },
        series: null,
        warnings: [],
      };
    });

    vi.mocked(apiModule.saveMedia).mockResolvedValue({
      episode: {
        id: 'ep-saved',
        sourceUrl: '',
        source: 'otakudesu',
        title: '',
        videoSources: [],
        createdAt: '',
        updatedAt: '',
      },
      series: null,
    });

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/Source URL/i), 'https://otakudesu.cloud/anime/test-series/');
    await user.click(screen.getByRole('button', { name: /Preview Scrape/i }));

    expect(await screen.findByDisplayValue('Episode 1 Original First')).toBeInTheDocument();

    // Perform reorder (move index 1 to index 0)
    await waitFor(() => {
      useScrapeWorkerStore.getState().reorderEditablePreviewEpisodes(1, 0);
    });

    // Verify UI reflects the reorder immediately (#1 title input is now Episode 2)
    await waitFor(() => {
      expect(screen.getByLabelText(/Episode Title #1/i)).toHaveValue('Episode 2 Original Second');
      expect(screen.getByLabelText(/Episode Title #2/i)).toHaveValue('Episode 1 Original First');
    });

    // Click Save and verify saveMedia is invoked in the new order (Episode 2 first, then Episode 1)
    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(apiModule.saveMedia).toHaveBeenCalledTimes(2);
      expect(apiModule.saveMedia).toHaveBeenNthCalledWith(1, {
        episode: {
          sourceUrl: 'https://otakudesu.cloud/episode/ep2',
          source: 'otakudesu',
          title: 'Episode 2 Original Second',
          videoType: null,
          metadata: { publishedDate: '17 Jan 2025' },
          videoSources: [],
        },
        series: mockSeriesPreviewResult.series,
      });
      expect(apiModule.saveMedia).toHaveBeenNthCalledWith(2, {
        episode: {
          sourceUrl: 'https://otakudesu.cloud/episode/ep1',
          source: 'otakudesu',
          title: 'Episode 1 Original First',
          videoType: null,
          metadata: { publishedDate: '10 Jan 2025' },
          videoSources: [],
        },
        series: mockSeriesPreviewResult.series,
      });
    });
  });
});
