import { renderWithProviders, screen, waitFor, fireEvent } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ManageSourcesDialog } from '@/modules/videos/internal/ManageSourcesDialog';
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
    addVideoSources: vi.fn(),
    updateVideoSource: vi.fn(),
    deleteVideoSource: vi.fn(),
    presignUploadSource: vi.fn(),
    uploadBinaryToS3: vi.fn(),
  };
});

const mockEpisode: apiModule.Episode = {
  id: 'ep-123',
  sourceUrl: 'https://otakudesu.cloud/ep1',
  source: 'otakudesu',
  title: 'Episode 1',
  videoSources: [
    {
      id: 'src-1',
      type: 'direct',
      url: 'https://stream.com/video1.mp4',
      label: 'Server 1',
      quality: '1080p',
    },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('ManageSourcesDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed or episode is null', () => {
    const { container } = renderWithProviders(
      <ManageSourcesDialog open={false} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('previews scrape result and saves sources successfully', async () => {
    const mockPreviewResult: apiModule.PreviewScrapeResult = {
      episode: {
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Episode 1',
        videoType: 'mp4',
        videoSources: [
          {
            type: 'direct',
            url: 'https://stream.com/scraped.mp4',
            label: 'Scraped Server 1',
            quality: '720p',
          },
          {
            type: 'embed',
            url: 'https://embed.com/scraped',
            label: 'Scraped Embed',
          },
        ],
        metadata: {},
      },
      series: null,
      warnings: [],
    };

    vi.mocked(apiModule.previewScrape).mockResolvedValueOnce(mockPreviewResult);
    vi.mocked(apiModule.addVideoSources).mockResolvedValueOnce(mockEpisode);

    const onOpenChange = vi.fn();
    const { user, queryClient } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={onOpenChange} episode={mockEpisode} seriesId="series-1" />
    );

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Input URL
    const urlInput = screen.getByPlaceholderText(/https:\/\/otakudesu\.cloud\/episode/i);
    await user.type(urlInput, 'https://otakudesu.cloud/ep1');

    // Click Preview
    const previewBtn = screen.getByRole('button', { name: /^Preview$/i });
    await user.click(previewBtn);

    // Verify previewScrape called
    expect(apiModule.previewScrape).toHaveBeenCalledWith({
      sourceUrl: 'https://otakudesu.cloud/ep1',
      source: 'otakudesu',
    });

    // Verify preview extracted sources displayed
    expect(await screen.findByText('Extracted Sources (2)')).toBeInTheDocument();
    expect(screen.getByText('Scraped Server 1')).toBeInTheDocument();
    expect(screen.getByText('Scraped Embed')).toBeInTheDocument();

    // Click Save Sources
    const saveBtn = screen.getByRole('button', { name: /Save Sources/i });
    await user.click(saveBtn);

    // Verify addVideoSources API called
    await waitFor(() => {
      expect(apiModule.addVideoSources).toHaveBeenCalledWith(
        'ep-123',
        mockPreviewResult.episode.videoSources
      );
    });

    // Verify cache invalidation, toast notification, and tab switch
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-1'] });
      expect(toast.success).toHaveBeenCalledWith('video.source_add', {
        description: 'Successfully saved video sources',
      });
      // Extracted state cleared and active tab switched to edit-existing (where existing source is shown)
      expect(screen.getByDisplayValue('Server 1')).toBeInTheDocument();
    });
  });

  it('renders the "Upload Video" tab in the tabs list', async () => {
    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    const uploadTab = screen.getByRole('tab', { name: /upload video/i });
    expect(uploadTab).toBeInTheDocument();

    await user.click(uploadTab);
    expect(screen.getByText('Upload Video to S3')).toBeInTheDocument();
    expect(screen.getByText(/click to select or drag video here/i)).toBeInTheDocument();
  });

  it('selecting a video file auto-fills the label without extension', async () => {
    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    await user.click(screen.getByRole('tab', { name: /upload video/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput.getAttribute('accept')).toContain('.mp4');

    const file = new File(['fake video'], 'my-episode-video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText('my-episode-video.mp4')).toBeInTheDocument();
    expect(screen.getByLabelText(/label/i)).toHaveValue('my-episode-video');
  });

  it('uploads via presigned URL with progress and registers an s3 source', async () => {
    vi.mocked(apiModule.presignUploadSource).mockResolvedValueOnce({
      uploadUrl: 'https://s3.example.com/put-url',
      key: 'episodes/ep-123/uuid-my-video.mp4',
    });
    vi.mocked(apiModule.uploadBinaryToS3).mockImplementation(async ({ onProgress }) => {
      onProgress?.({ percent: 50, loaded: 50 * 1024 * 1024, total: 100 * 1024 * 1024 });
      onProgress?.({ percent: 100, loaded: 100 * 1024 * 1024, total: 100 * 1024 * 1024 });
    });
    vi.mocked(apiModule.addVideoSources).mockResolvedValueOnce(mockEpisode);

    const { user, queryClient } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('tab', { name: /upload video/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake video'], 'my-video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Quality field
    await user.type(screen.getByPlaceholderText('e.g. 1080p'), '1080p');

    // Upload button enabled once file + label present
    const uploadBtn = screen.getByRole('button', { name: /^upload$/i });
    expect(uploadBtn).toBeEnabled();
    await user.click(uploadBtn);

    // Presign requested via POST /api/media/episodes/:id/sources/presign-upload contract
    await waitFor(() => {
      expect(apiModule.presignUploadSource).toHaveBeenCalledWith('ep-123', {
        filename: 'my-video.mp4',
        contentType: 'video/mp4',
      });
    });

    // Binary uploaded directly to presigned URL with progress + file payload
    await waitFor(() => {
      expect(apiModule.uploadBinaryToS3).toHaveBeenCalled();
    });
    const uploadArgs = vi.mocked(apiModule.uploadBinaryToS3).mock.calls[0][0];
    expect(uploadArgs.url).toBe('https://s3.example.com/put-url');
    expect(uploadArgs.file).toBe(file);
    expect(uploadArgs.signal).toBeInstanceOf(AbortSignal);
    expect(typeof uploadArgs.onProgress).toBe('function');

    // Source registered with type s3 + S3 key, cache invalidated, toast shown, tab switched
    await waitFor(() => {
      expect(apiModule.addVideoSources).toHaveBeenCalledWith('ep-123', {
        type: 's3',
        url: 'episodes/ep-123/uuid-my-video.mp4',
        label: 'my-video',
        quality: '1080p',
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-1'] });
      expect(toast.success).toHaveBeenCalledWith('video.source_add', {
        description: 'Successfully uploaded and registered video source',
      });
      expect(screen.getByDisplayValue('Server 1')).toBeInTheDocument();
    });
  });

  it('cancel aborts the active upload and resets the upload UI', async () => {
    vi.mocked(apiModule.presignUploadSource).mockResolvedValueOnce({
      uploadUrl: 'https://s3.example.com/put-url',
      key: 'episodes/ep-123/uuid-big-video.mp4',
    });
    // Never-resolving upload that rejects on abort, simulating mid-flight cancellation
    vi.mocked(apiModule.uploadBinaryToS3).mockImplementation(
      ({ onProgress, signal }) =>
        new Promise<void>((_resolve, reject) => {
          onProgress?.({ percent: 17, loaded: 142 * 1024 * 1024, total: 850 * 1024 * 1024 });
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );

    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    await user.click(screen.getByRole('tab', { name: /upload video/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['fake video'], 'big-video.mp4', { type: 'video/mp4' })] },
    });

    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    // Live percentage + MB progress feedback while uploading
    expect(await screen.findByText('Uploading to S3...')).toBeInTheDocument();
    expect(screen.getByText(/142\.0 MB \/ 850\.0 MB \(17%\)/)).toBeInTheDocument();

    // Cancel mid-flight
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    // Upload UI reset: no progress, dropzone placeholder back, Upload button back disabled
    await waitFor(() => {
      expect(screen.queryByText('Uploading to S3...')).not.toBeInTheDocument();
      expect(screen.getByText(/click to select or drag video here/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^upload$/i })).toBeDisabled();
    });
    expect(apiModule.addVideoSources).not.toHaveBeenCalled();
  });

  it('shows a warning banner when S3 storage is unconfigured', async () => {
    const err = new Error('S3 storage service is not configured') as Error & { code: string };
    err.code = 'S3_NOT_CONFIGURED';
    vi.mocked(apiModule.presignUploadSource).mockRejectedValueOnce(err);

    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    await user.click(screen.getByRole('tab', { name: /upload video/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['fake video'], 'clip.mp4', { type: 'video/mp4' })] },
    });

    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByText('S3 Storage Unconfigured')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('video.s3_upload', {
      description: 'S3 storage service is not configured',
    });
    expect(apiModule.uploadBinaryToS3).not.toHaveBeenCalled();
    expect(apiModule.addVideoSources).not.toHaveBeenCalled();
  });
});
