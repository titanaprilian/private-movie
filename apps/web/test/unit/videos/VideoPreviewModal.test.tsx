import { renderWithProviders, screen, userEvent } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { VideoPreviewModal } from '@/modules/videos/internal/VideoPreviewModal';
import type { VideoSource } from '@/modules/videos/internal/api';

describe('VideoPreviewModal Component', () => {
  it('does not render when source is null', () => {
    renderWithProviders(
      <VideoPreviewModal
        open={true}
        onOpenChange={vi.fn()}
        source={null}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders CustomVideoPlayer for direct video sources', () => {
    const directSource: VideoSource = {
      id: 'src-direct',
      type: 'direct',
      url: 'https://stream.example.com/video.mp4',
      label: 'Server Direct 1080p',
      quality: '1080p',
    };

    renderWithProviders(
      <VideoPreviewModal
        open={true}
        onOpenChange={vi.fn()}
        source={directSource}
        episodeTitle="Episode 1"
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Server Direct 1080p — Episode 1/)).toBeInTheDocument();
    expect(screen.getByText('https://stream.example.com/video.mp4')).toBeInTheDocument();

    // Check video element rendered by CustomVideoPlayer
    const video = screen.getByTestId('custom-video-element');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'https://stream.example.com/video.mp4');
  });

  it('renders CustomVideoPlayer for s3 video sources', () => {
    const s3Source: VideoSource = {
      id: 'src-s3',
      type: 's3',
      url: 'https://s3.example.com/bucket/ep1.mp4',
      label: 'S3 High Bitrate',
      quality: '4K',
    };

    renderWithProviders(
      <VideoPreviewModal
        open={true}
        onOpenChange={vi.fn()}
        source={s3Source}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('S3 High Bitrate').length).toBeGreaterThan(0);
    expect(screen.getByText('s3')).toBeInTheDocument();

    const video = screen.getByTestId('custom-video-element');
    expect(video).toBeInTheDocument();
  });

  it('renders sandboxed iframe for embed video sources with strict security attributes', () => {
    const embedSource: VideoSource = {
      id: 'src-embed',
      type: 'embed',
      url: 'https://videobello.net/embed/ZXBpc29kZTE',
      label: 'Videobello Embed',
    };

    renderWithProviders(
      <VideoPreviewModal
        open={true}
        onOpenChange={vi.fn()}
        source={embedSource}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const iframe = screen.getByTitle('Videobello Embed');
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName.toLowerCase()).toBe('iframe');
    expect(iframe).toHaveAttribute('src', '/embed/ZXBpc29kZTE');
    expect(iframe).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-forms allow-presentation'
    );
    expect(iframe).toHaveAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen'
    );
    expect(iframe.hasAttribute('allowfullscreen')).toBe(true);

    const sandbox = iframe.getAttribute('sandbox') || '';
    expect(sandbox).not.toContain('allow-popups');
    expect(sandbox).not.toContain('allow-popups-to-escape-sandbox');
    expect(sandbox).not.toContain('allow-top-navigation');
  });

  it('invokes onOpenChange when closed via close button', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    const directSource: VideoSource = {
      id: 'src-1',
      type: 'direct',
      url: 'https://stream.example.com/video.mp4',
      label: 'Server 1',
    };

    renderWithProviders(
      <VideoPreviewModal
        open={true}
        onOpenChange={onOpenChange}
        source={directSource}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
