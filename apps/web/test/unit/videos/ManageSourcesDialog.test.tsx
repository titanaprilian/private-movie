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
    uploadEpisodeVideoSource: vi.fn(),
    getUploadProgress: vi.fn(),
    remoteIngestEpisodeVideoSource: vi.fn(),
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

  it('uploads via the backend proxy endpoint with progress and switches to edit tab', async () => {
    vi.mocked(apiModule.uploadEpisodeVideoSource).mockImplementation(
      async (_episodeId, { onProgress }) => {
        onProgress?.({ percent: 50, loaded: 50 * 1024 * 1024, total: 100 * 1024 * 1024 });
        onProgress?.({ percent: 100, loaded: 100 * 1024 * 1024, total: 100 * 1024 * 1024 });
        return mockEpisode;
      }
    );

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

    // File uploaded through the backend proxy endpoint (no B2 CORS):
    // POST /api/media/episodes/:id/sources/upload via multipart XHR
    await waitFor(() => {
      expect(apiModule.uploadEpisodeVideoSource).toHaveBeenCalledOnce();
    });
    const [episodeId, uploadArgs] = vi.mocked(apiModule.uploadEpisodeVideoSource).mock.calls[0];
    expect(episodeId).toBe('ep-123');
    expect(uploadArgs.file).toBe(file);
    expect(uploadArgs.label).toBe('my-video');
    expect(uploadArgs.quality).toBe('1080p');
    expect(uploadArgs.signal).toBeInstanceOf(AbortSignal);
    expect(typeof uploadArgs.onProgress).toBe('function');

    // Successful upload automatically registers the S3 source server-side:
    // no separate client-side source registration call is needed
    expect(apiModule.addVideoSources).not.toHaveBeenCalled();

    // Cache invalidated, toast shown, tab switched to Edit Existing
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-1'] });
      expect(toast.success).toHaveBeenCalledWith('video.source_add', {
        description: 'Successfully uploaded and registered video source',
      });
      expect(screen.getByDisplayValue('Server 1')).toBeInTheDocument();
    });
  });

  it('cancel aborts the active upload and resets the upload UI', async () => {
    // Never-resolving proxy upload that emits progress then rejects on abort,
    // simulating mid-flight cancellation
    vi.mocked(apiModule.uploadEpisodeVideoSource).mockImplementation(
      (_episodeId, { onProgress, signal }) =>
        new Promise<apiModule.Episode>((_resolve, reject) => {
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
    expect(await screen.findByText('Uploading...')).toBeInTheDocument();
    expect(screen.getByText(/142\.0 MB \/ 850\.0 MB \(17%\)/)).toBeInTheDocument();

    // Cancel mid-flight
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    // Upload UI reset: no progress, dropzone placeholder back, Upload button back disabled
    await waitFor(() => {
      expect(screen.queryByText('Uploading...')).not.toBeInTheDocument();
      expect(screen.getByText(/click to select or drag video here/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^upload$/i })).toBeDisabled();
    });
    expect(apiModule.addVideoSources).not.toHaveBeenCalled();
  });

  it('shows a warning banner when S3 storage is unconfigured', async () => {
    const err = new Error('S3 storage service is not configured') as Error & { code: string };
    err.code = 'S3_NOT_CONFIGURED';
    vi.mocked(apiModule.uploadEpisodeVideoSource).mockRejectedValueOnce(err);

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
    expect(apiModule.uploadEpisodeVideoSource).toHaveBeenCalledOnce();
    expect(apiModule.addVideoSources).not.toHaveBeenCalled();
  });

  it('rejects oversized file selection with toast warning and prevents upload', async () => {
    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    await user.click(screen.getByRole('tab', { name: /upload video/i }));

    const oversizedFile = new File(['x'.repeat(100)], 'huge-video.mp4', { type: 'video/mp4' });
    Object.defineProperty(oversizedFile, 'size', {
      value: 1024 * 1024 * 1024 + 1024, // > 1GB
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [oversizedFile] },
    });

    expect(toast.error).toHaveBeenCalledWith('video.file_size_exceeded', {
      description: 'File size exceeds the maximum limit of 1 GB',
    });
    expect(screen.getByRole('button', { name: /^upload$/i })).toBeDisabled();
    expect(apiModule.uploadEpisodeVideoSource).not.toHaveBeenCalled();
  });

  it('surfaces descriptive error message when upload fails with HTTP 413 FILE_TOO_LARGE', async () => {
    const err = new Error('File size exceeds the maximum allowed limit of 1GB') as Error & { code: string };
    err.code = 'FILE_TOO_LARGE';
    vi.mocked(apiModule.uploadEpisodeVideoSource).mockRejectedValueOnce(err);

    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    await user.click(screen.getByRole('tab', { name: /upload video/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['fake video'], 'clip.mp4', { type: 'video/mp4' })] },
    });

    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(toast.error).toHaveBeenCalledWith('video.s3_upload', {
      description: 'Failed to upload video: File size exceeds the maximum allowed limit of 1GB',
    });
    expect(apiModule.uploadEpisodeVideoSource).toHaveBeenCalledOnce();
  });

  it('renders s3 badge with purple styling and allows editing s3 sources', async () => {
    const s3Episode: apiModule.Episode = {
      ...mockEpisode,
      videoSources: [
        {
          id: 'src-s3-1',
          type: 's3',
          url: 'episodes/ep-123/video.mp4',
          label: 'Backblaze B2 Mirror',
          quality: '1080p',
        },
      ],
    };

    const updatedEpisode: apiModule.Episode = {
      ...s3Episode,
      videoSources: [
        {
          ...s3Episode.videoSources![0],
          label: 'Updated B2 Mirror',
          quality: '4k',
        },
      ],
    };

    vi.mocked(apiModule.updateVideoSource).mockResolvedValueOnce(updatedEpisode);

    const { user, queryClient } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={s3Episode} seriesId="series-1" />
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Switch to Edit Existing tab
    await user.click(screen.getByRole('tab', { name: /edit existing/i }));

    // Verify S3 badge rendering
    const s3Badge = screen.getByText('s3');
    expect(s3Badge).toBeInTheDocument();
    expect(s3Badge.className).toContain('bg-purple-100');
    expect(s3Badge.className).toContain('text-purple-700');

    // Verify S3 option in Type selector
    const typeSelect = screen.getByRole('combobox') as HTMLSelectElement;
    expect(typeSelect.value).toBe('s3');
    expect(screen.getByRole('option', { name: 'S3 Storage' })).toBeInTheDocument();

    // Edit fields
    const labelInput = screen.getByDisplayValue('Backblaze B2 Mirror');
    await user.clear(labelInput);
    await user.type(labelInput, 'Updated B2 Mirror');

    const qualityInput = screen.getByDisplayValue('1080p');
    await user.clear(qualityInput);
    await user.type(qualityInput, '4k');

    // Click Update Source
    const updateBtn = screen.getByRole('button', { name: /update source/i });
    await user.click(updateBtn);

    await waitFor(() => {
      expect(apiModule.updateVideoSource).toHaveBeenCalledWith('ep-123', 'src-s3-1', {
        type: 's3',
        label: 'Updated B2 Mirror',
        url: 'episodes/ep-123/video.mp4',
        quality: '4k',
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-1'] });
      expect(toast.success).toHaveBeenCalledWith('video.source_update', {
        description: 'Successfully updated video source',
      });
    });
  });

  it('deletes an S3 source and triggers query invalidation', async () => {
    const s3Episode: apiModule.Episode = {
      ...mockEpisode,
      videoSources: [
        {
          id: 'src-s3-del',
          type: 's3',
          url: 'episodes/ep-123/del-video.mp4',
          label: 'S3 to Delete',
          quality: '720p',
        },
      ],
    };

    const emptyEpisode: apiModule.Episode = {
      ...s3Episode,
      videoSources: [],
    };

    vi.mocked(apiModule.deleteVideoSource).mockResolvedValueOnce(emptyEpisode);

    const { user, queryClient } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={s3Episode} seriesId="series-1" />
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Switch to Edit Existing tab
    await user.click(screen.getByRole('tab', { name: /edit existing/i }));

    const removeBtn = screen.getByRole('button', { name: /remove source/i });
    await user.click(removeBtn);

    await waitFor(() => {
      expect(apiModule.deleteVideoSource).toHaveBeenCalledWith('ep-123', 'src-s3-del');
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-1'] });
      expect(toast.success).toHaveBeenCalledWith('video.source_delete', {
        description: 'Successfully removed video source',
      });
    });
  });

  it('renders Remote Ingest tab and auto-parses URL to prefill label and quality', async () => {
    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    const remoteTab = screen.getByRole('tab', { name: /remote ingest/i });
    expect(remoteTab).toBeInTheDocument();

    await user.click(remoteTab);
    expect(screen.getByText('Ingest Remote Video URL to S3')).toBeInTheDocument();

    const urlInput = screen.getByPlaceholderText('https://example.com/video.mp4');
    await user.type(urlInput, 'https://cdn.example.com/shows/Movie.2026.1080p.mp4');

    expect(screen.getByDisplayValue('S3 1080p')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1080p')).toBeInTheDocument();
  });

  it('1-click "Ingest to S3" shortcut button on direct source populates form and switches tab', async () => {
    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    // Switch to edit existing tab
    await user.click(screen.getByRole('tab', { name: /edit existing/i }));

    const ingestShortcutBtn = screen.getByRole('button', { name: /ingest to s3/i });
    expect(ingestShortcutBtn).toBeInTheDocument();

    await user.click(ingestShortcutBtn);

    // Should switch to remote ingest tab with pre-filled fields from direct source
    expect(screen.getByText('Ingest Remote Video URL to S3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://stream.com/video1.mp4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('S3 1080p')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1080p')).toBeInTheDocument();
  });

  it('remotes ingest with SSE progress updates and completes successfully', async () => {
    const updatedEpisode: apiModule.Episode = {
      ...mockEpisode,
      videoSources: [
        ...mockEpisode.videoSources!,
        {
          id: 'src-s3-new',
          type: 's3',
          url: 'episodes/ep-123/video.mp4',
          label: 'S3 1080p',
          quality: '1080p',
        },
      ],
    };

    vi.mocked(apiModule.remoteIngestEpisodeVideoSource).mockImplementation(
      async (_episodeId, { onProgress }) => {
        onProgress?.({ percent: 45, loaded: 45 * 1024 * 1024, total: 100 * 1024 * 1024 });
        onProgress?.({ percent: 100, loaded: 100 * 1024 * 1024, total: 100 * 1024 * 1024 });
        return updatedEpisode;
      }
    );

    const { user, queryClient } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('tab', { name: /remote ingest/i }));

    const urlInput = screen.getByPlaceholderText('https://example.com/video.mp4');
    await user.type(urlInput, 'https://remote.com/my-video.1080p.mp4');

    // Open advanced headers section
    await user.click(screen.getByText(/advanced headers/i));
    const refererInput = screen.getByPlaceholderText('e.g. https://remotehost.com');
    await user.type(refererInput, 'https://remote.com');

    const startBtn = screen.getByRole('button', { name: /^ingest to s3$/i });
    await user.click(startBtn);

    await waitFor(() => {
      expect(apiModule.remoteIngestEpisodeVideoSource).toHaveBeenCalledWith('ep-123', {
        url: 'https://remote.com/my-video.1080p.mp4',
        label: 'S3 1080p',
        quality: '1080p',
        referer: 'https://remote.com',
        signal: expect.any(AbortSignal),
        onProgress: expect.any(Function),
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-1'] });
      expect(toast.success).toHaveBeenCalledWith('video.remote_ingest', {
        description: 'Successfully ingested remote video to S3',
      });
      // Switched to Edit Existing tab showing server 1
      expect(screen.getByDisplayValue('Server 1')).toBeInTheDocument();
    });
  });

  it('cancel remote ingest aborts transfer and resets state', async () => {
    vi.mocked(apiModule.remoteIngestEpisodeVideoSource).mockImplementation(
      (_episodeId, { onProgress, signal }) =>
        new Promise<apiModule.Episode>((_resolve, reject) => {
          onProgress?.({ percent: 30, loaded: 30 * 1024 * 1024, total: 100 * 1024 * 1024 });
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );

    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    await user.click(screen.getByRole('tab', { name: /remote ingest/i }));

    const urlInput = screen.getByPlaceholderText('https://example.com/video.mp4');
    await user.type(urlInput, 'https://remote.com/huge-video.mp4');

    await user.click(screen.getByRole('button', { name: /^ingest to s3$/i }));

    expect(await screen.findByText('Ingesting...')).toBeInTheDocument();
    expect(screen.getByText(/30\.0 MB \/ 100\.0 MB \(30%\)/)).toBeInTheDocument();

    // Click Cancel Ingest
    await user.click(screen.getByRole('button', { name: /^cancel ingest$/i }));

    await waitFor(() => {
      expect(screen.queryByText('Ingesting...')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^ingest to s3$/i })).toBeDisabled();
    });
  });

  it('displays S3NotConfiguredError banner on S3 unconfigured error', async () => {
    const err = new Error('S3 storage service is not configured') as Error & { code: string };
    err.code = 'S3_NOT_CONFIGURED';
    vi.mocked(apiModule.remoteIngestEpisodeVideoSource).mockRejectedValueOnce(err);

    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    await user.click(screen.getByRole('tab', { name: /remote ingest/i }));

    const urlInput = screen.getByPlaceholderText('https://example.com/video.mp4');
    await user.type(urlInput, 'https://remote.com/clip.mp4');

    await user.click(screen.getByRole('button', { name: /^ingest to s3$/i }));

    expect(await screen.findByText('S3 Storage Unconfigured')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('video.remote_ingest', {
      description: 'S3 storage service is not configured',
    });
  });

  it('displays "Uploading to cloud storage..." indicator and polls getUploadProgress when client upload reaches 100%', async () => {
    let triggerProgress: ((progress: { percent: number; loaded: number; total: number }) => void) | undefined;
    vi.mocked(apiModule.uploadEpisodeVideoSource).mockImplementation(
      (_episodeId, { onProgress }) =>
        new Promise<apiModule.Episode>((_resolve) => {
          triggerProgress = onProgress;
          // Keep promise pending so dialog stays in uploading state
        })
    );

    vi.mocked(apiModule.getUploadProgress).mockResolvedValue({
      percent: 45,
      loaded: 45 * 1024 * 1024,
      total: 100 * 1024 * 1024,
    });

    const { user } = renderWithProviders(
      <ManageSourcesDialog open={true} onOpenChange={vi.fn()} episode={mockEpisode} seriesId="series-1" />
    );

    await user.click(screen.getByRole('tab', { name: /upload video/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['fake video'], 'my-video.mp4', { type: 'video/mp4' })] },
    });

    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByText('Uploading...')).toBeInTheDocument();

    // Trigger 100% phase 1 client-side progress
    triggerProgress?.({ percent: 100, loaded: 100 * 1024 * 1024, total: 100 * 1024 * 1024 });

    expect(await screen.findByText(/uploading to cloud storage\.\.\./i)).toBeInTheDocument();

    // Verify polling getUploadProgress
    await waitFor(() => {
      expect(apiModule.getUploadProgress).toHaveBeenCalled();
    });

    expect(await screen.findByText(/45\.0 MB \/ 100\.0 MB \(45%\)/)).toBeInTheDocument();
  });
});
