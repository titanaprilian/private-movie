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
    expect(screen.getByText('Parsed Test Series')).toBeInTheDocument();
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
      expect(toast.success).toHaveBeenCalledWith('Media saved successfully');
      expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
      expect(useScrapeWorkerStore.getState().step).toBe(1);
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

    expect(await screen.findByText('Grand Blue Season 3')).toBeInTheDocument();
    expect(screen.getByText('Grand Blue S3 Episode 1')).toBeInTheDocument();
    expect(screen.getByText('Grand Blue S3 Episode 2')).toBeInTheDocument();

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
});
