import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddMediaDialog } from '@/modules/videos/internal/AddMediaDialog';
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
    expect(screen.getByLabelText(/Raw HTML/i)).toBeInTheDocument();
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
        videoUrl: 'https://stream.com/video.mp4',
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
    const htmlInput = screen.getByLabelText(/Raw HTML/i);

    await user.type(urlInput, 'https://otakudesu.cloud/ep1');
    await user.type(htmlInput, '<html><body>Episode 1</body></html>');

    const submitBtn = screen.getByRole('button', { name: /Preview Scrape/i });
    await user.click(submitBtn);

    expect(await screen.findByText('Parsed Test Episode')).toBeInTheDocument();
    expect(screen.getByText('Parsed Test Series')).toBeInTheDocument();
    expect(
      screen.getByText('Series details missing episode count')
    ).toBeInTheDocument();
    expect(screen.getByText(/Step 2/i)).toBeInTheDocument();
  });
});
